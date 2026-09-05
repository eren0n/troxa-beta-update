"""Meta Marketing API client for data_lab.
Fetches ads and insights. Images are served via proxy on demand — no bulk download during sync.
"""
import os
import logging
import requests
from pathlib import Path
from django.conf import settings
from .metric_config import ACTION_MAP, REVENUE_ACTION_TYPES

logger = logging.getLogger(__name__)

META_API_VERSION = 'v21.0'
GRAPH = f'https://graph.facebook.com/{META_API_VERSION}'

AD_FIELDS = (
    'id,name,status,'
    'campaign_id,campaign{name,objective},'
    'adset_id,adset{name,daily_budget,lifetime_budget},'
    'creative{id,thumbnail_url,image_url}'
)
INSIGHT_FIELDS = 'impressions,reach,clicks,spend,actions,action_values,cost_per_action_type,purchase_roas'

# Action types used for direct API cost lookups — pixel event keys only.
_FTP_ACTION_TYPE  = 'offsite_conversion.fb_pixel_initiate_checkout'
_REGS_ACTION_TYPE = 'offsite_conversion.fb_pixel_complete_registration'


def _token():
    t = os.environ.get('META_ADS_ACCESS_TOKEN', '').strip()
    if not t:
        raise ValueError('META_ADS_ACCESS_TOKEN not configured')
    return t


def _resolve_account_id(token, account_id=None):
    if account_id:
        return account_id.replace('act_', '')
    env_id = os.environ.get('META_ADS_ACCOUNT_ID', '').strip()
    if env_id:
        return env_id.replace('act_', '')

    resp = requests.get(
        f'{GRAPH}/me/adaccounts',
        params={'fields': 'id,name,account_id', 'access_token': token, 'limit': 50},
        timeout=15,
    )
    data = resp.json()
    if err := data.get('error'):
        raise RuntimeError(err.get('message', 'Meta API error'))
    accounts = [a['account_id'] for a in data.get('data', []) if a.get('account_id')]
    if accounts:
        return accounts[0]

    biz_resp = requests.get(
        f'{GRAPH}/me/businesses',
        params={'fields': 'id,name', 'access_token': token, 'limit': 10},
        timeout=15,
    )
    biz_data = biz_resp.json()
    if err := biz_data.get('error'):
        raise RuntimeError(err.get('message', 'Meta API error'))
    for biz in biz_data.get('data', []):
        biz_id = biz['id']
        for endpoint in ('owned_ad_accounts', 'client_ad_accounts'):
            r = requests.get(
                f'{GRAPH}/{biz_id}/{endpoint}',
                params={'fields': 'id,name,account_id', 'access_token': token, 'limit': 50},
                timeout=15,
            )
            for a in r.json().get('data', []):
                acct = a.get('account_id') or a.get('id', '').replace('act_', '')
                if acct:
                    return acct

    raise RuntimeError('No Meta ad account found for this token. Set META_ADS_ACCOUNT_ID in .env to skip auto-detection.')


def _pick(items, keys):
    if not items:
        return 0.0
    total = 0.0
    for item in items:
        if item.get('action_type') in keys:
            try:
                total += float(item.get('value', 0))
            except (ValueError, TypeError):
                pass
    return total


def _pick_cost(items, action_type):
    """Return the first matching cost value from cost_per_action_type array."""
    if not items:
        return None
    for item in items:
        if item.get('action_type') == action_type:
            try:
                return round(float(item['value']), 4)
            except (KeyError, ValueError, TypeError):
                pass
    return None


def _normalize_metrics(ins):
    actions = ins.get('actions', [])
    action_values = ins.get('action_values', [])
    cost_per_action = ins.get('cost_per_action_type', [])
    regs = _pick(actions, ACTION_MAP['regs'])
    ftp_raw = _pick(actions, ACTION_MAP['ftp'])
    purchases = _pick(actions, ACTION_MAP['purchases'])
    revenue = _pick(action_values, REVENUE_ACTION_TYPES)
    # cost_per_* and roas come directly from Meta — no local division needed.
    cost_per_ftp  = _pick_cost(cost_per_action, _FTP_ACTION_TYPE)
    cost_per_reg  = _pick_cost(cost_per_action, _REGS_ACTION_TYPE)
    # purchase_roas is an array; omni_purchase is Meta's canonical purchase ROAS key.
    roas = _pick_cost(ins.get('purchase_roas', []), 'omni_purchase')
    return {
        'impressions': int(ins.get('impressions', 0) or 0),
        'reach': int(ins.get('reach', 0) or 0),
        'clicks': int(ins.get('clicks', 0) or 0),
        'spend': float(ins.get('spend', 0) or 0),
        'regs': regs,
        'cost_per_reg': cost_per_reg,
        'ftp': ftp_raw if ftp_raw > 0 else None,
        'cost_per_ftp': cost_per_ftp,
        'purchases': purchases,
        'revenue': revenue,
        'roas': roas,
    }


def _fetch_all_ads(account_id, date_preset='maximum'):
    token = _token()
    params = {
        'fields': f'{AD_FIELDS},insights.date_preset({date_preset}){{{INSIGHT_FIELDS}}}',
        'access_token': token,
        'limit': 25,
    }
    url = f'{GRAPH}/act_{account_id}/ads'
    ads = []
    while url:
        resp = requests.get(url, params=params, timeout=30)
        data = resp.json()
        if 'error' in data:
            raise RuntimeError(data['error'].get('message', 'Meta API error'))
        ads.extend(data.get('data', []))
        next_url = data.get('paging', {}).get('next')
        url = next_url
        params = {}
    return ads


def _adimages_url(hashes, token, acct_id):
    """Resolve a list of image hashes to full-size URLs via the adimages endpoint."""
    acct_id = acct_id.replace('act_', '')
    try:
        resp = requests.get(
            f'{GRAPH}/act_{acct_id}/adimages',
            params={'fields': 'hash,url', 'hashes[]': hashes[0], 'access_token': token, 'limit': 1},
            timeout=15,
        )
        for img in resp.json().get('data', []):
            if img.get('url'):
                return img['url']
    except Exception as e:
        logger.debug('adimages lookup failed: %s', e)
    return None


def _best_video_thumbnail(video_id, token):
    """Fetch the highest-resolution thumbnail for a video creative."""
    try:
        resp = requests.get(
            f'{GRAPH}/{video_id}',
            params={'fields': 'picture,thumbnails', 'access_token': token},
            timeout=15,
        )
        data = resp.json()
        best = data.get('picture')
        thumbs = data.get('thumbnails', {}).get('data', [])
        if thumbs:
            best_thumb = max(thumbs, key=lambda t: t.get('width', 0))
            best = best_thumb.get('uri') or best
        return best
    except Exception as e:
        logger.debug('video thumbnail lookup failed for %s: %s', video_id, e)
    return None


def fetch_media_info(ad_id, token=None):
    """Return media type + direct CDN URLs for an ad creative.
    For video ads: {'media_type': 'video', 'video_url': '...', 'poster_url': '...'}
    For image ads: {'media_type': 'image'}
    On failure:    {'media_type': 'none'}
    video_url / poster_url are Meta CDN URLs — no auth required in the browser.
    """
    if token is None:
        token = _token()
    try:
        resp = requests.get(
            f'{GRAPH}/{ad_id}',
            params={'fields': 'creative{id,video_id}', 'access_token': token},
            timeout=15,
        )
        data = resp.json()
        creative = data.get('creative', {})
        creative_id = creative.get('id')
        if not creative_id:
            return {'media_type': 'none'}

        # Collect all candidate video IDs
        video_ids = []
        if creative.get('video_id'):
            video_ids.append(creative['video_id'])
        try:
            c_resp = requests.get(
                f'{GRAPH}/{creative_id}',
                params={'fields': 'video_id,object_story_spec', 'access_token': token},
                timeout=10,
            )
            c_data = c_resp.json()
            if c_data.get('video_id'):
                video_ids.append(c_data['video_id'])
            spec = c_data.get('object_story_spec', {})
            vd_id = spec.get('video_data', {}).get('video_id')
            if vd_id:
                video_ids.append(vd_id)
            ld_id = (spec.get('link_data', {}).get('child_attachments') or [{}])[0].get('video_id')
            if ld_id:
                video_ids.append(ld_id)
        except Exception:
            pass

        for vid in dict.fromkeys(video_ids):
            try:
                v_resp = requests.get(
                    f'{GRAPH}/{vid}',
                    params={'fields': 'source,picture,thumbnails', 'access_token': token},
                    timeout=15,
                )
                v_data = v_resp.json()
                video_url = v_data.get('source')
                poster_url = v_data.get('picture') or None
                thumbs = v_data.get('thumbnails', {}).get('data', [])
                if thumbs:
                    best = max(thumbs, key=lambda t: t.get('width', 0))
                    poster_url = best.get('uri') or poster_url
                if video_url:
                    return {'media_type': 'video', 'video_url': video_url, 'poster_url': poster_url}
            except Exception:
                pass

        return {'media_type': 'image'}
    except Exception as exc:
        logger.warning('fetch_media_info failed for ad %s: %s', ad_id, exc)
        return {'media_type': 'none'}


def fetch_creative_image(ad_id, token=None):
    """Fetch and return (image_bytes, content_type) for a single ad's creative.

    Resolution strategy (best-first):
    1. Static image creative  → image_url (full-size)
    2. Dynamic creative       → adimages API with image hash (1024px)
    3. Video creative         → best thumbnail from video object
    4. Fallback               → thumbnail_url (low-res)
    """
    if token is None:
        token = _token()
    acct_id = os.environ.get('META_ADS_ACCOUNT_ID', '').strip()
    try:
        resp = requests.get(
            f'{GRAPH}/{ad_id}',
            params={
                'fields': 'creative{id,image_url,thumbnail_url,image_hash,video_id,asset_feed_spec{images{hash}}}',
                'access_token': token,
            },
            timeout=15,
        )
        data = resp.json()
        creative = data.get('creative', {})
        creative_id = creative.get('id')
        image_url = creative.get('image_url')

        # Static image with image_hash: image_url is already full-size
        if not image_url and creative.get('image_hash') and acct_id:
            image_url = _adimages_url([creative['image_hash']], token, acct_id)

        # Dynamic creative: get full-size via asset_feed_spec image hashes
        if not image_url:
            spec = creative.get('asset_feed_spec') or {}
            hashes = [img['hash'] for img in (spec.get('images') or []) if img.get('hash')]
            if hashes and acct_id:
                image_url = _adimages_url(hashes, token, acct_id)

        # Video creative: fetch best thumbnail — collect all candidate video IDs
        if not image_url and creative_id:
            video_ids = []
            if creative.get('video_id'):
                video_ids.append(creative['video_id'])
            try:
                c_resp = requests.get(
                    f'{GRAPH}/{creative_id}',
                    params={'fields': 'video_id,object_story_spec', 'access_token': token},
                    timeout=10,
                )
                c_data = c_resp.json()
                if c_data.get('video_id'):
                    video_ids.append(c_data['video_id'])
                spec = c_data.get('object_story_spec', {})
                vd_id = spec.get('video_data', {}).get('video_id')
                if vd_id:
                    video_ids.append(vd_id)
                ld_id = (spec.get('link_data', {}).get('child_attachments') or [{}])[0].get('video_id')
                if ld_id:
                    video_ids.append(ld_id)
            except Exception:
                pass
            # Try each video ID; use the first that yields a thumbnail
            for vid in dict.fromkeys(video_ids):  # preserve order, deduplicate
                url = _best_video_thumbnail(vid, token)
                if url:
                    image_url = url
                    break

        # Last resort: low-res thumbnail_url
        if not image_url:
            image_url = creative.get('thumbnail_url')
        if not image_url:
            return None, None

        img_resp = requests.get(image_url, timeout=20, headers={'User-Agent': 'Mozilla/5.0'})
        img_resp.raise_for_status()
        ct = img_resp.headers.get('Content-Type', 'image/jpeg')
        return img_resp.content, ct
    except Exception as exc:
        logger.warning('fetch_creative_image failed for ad %s: %s', ad_id, exc)
        return None, None


def sync_account(account_id=None, date_preset='maximum', download_images=False):
    """Fetch all ads and return list of dicts ready for upserting.
    Images are NOT downloaded — only URLs are stored.
    """
    token = _token()
    resolved_id = _resolve_account_id(token, account_id)
    raw_ads = _fetch_all_ads(resolved_id, date_preset)
    results = []

    for ad in raw_ads:
        ad_id = ad.get('id', '')
        if not ad_id:
            continue

        campaign = ad.get('campaign') or {}
        adset = ad.get('adset') or {}
        creative = ad.get('creative') or {}

        # Prefer image_url (full-size) over thumbnail_url
        image_url = creative.get('image_url') or creative.get('thumbnail_url') or ''

        insights_data = ad.get('insights', {}).get('data', [])
        ins = insights_data[0] if insights_data else {}
        metrics = _normalize_metrics(ins)

        def _budget(val):
            if val:
                try:
                    return float(val) / 100
                except (ValueError, TypeError):
                    pass
            return None

        results.append({
            'ad_id': ad_id,
            'ad_name': ad.get('name', ''),
            'campaign_id': ad.get('campaign_id', '') or campaign.get('id', ''),
            'campaign_name': campaign.get('name', ''),
            'adset_id': ad.get('adset_id', '') or adset.get('id', ''),
            'adset_name': adset.get('name', ''),
            'ad_status': ad.get('status', ''),
            'objective': campaign.get('objective', ''),
            'daily_budget': _budget(adset.get('daily_budget')),
            'lifetime_budget': _budget(adset.get('lifetime_budget')),
            'creative_image_url': image_url,
            'creative_image_path': '',
            'raw_insights': ins or None,
            'raw_ad': ad,
            **metrics,
        })

    return results
