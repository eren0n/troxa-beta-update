"""
Meta Marketing API helpers.
Docs: https://developers.facebook.com/docs/marketing-api
"""
import io
import logging
import requests as http_requests

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

GRAPH_API  = 'https://graph.facebook.com/v20.0'
OAUTH_URL  = 'https://www.facebook.com/v20.0/dialog/oauth'
TOKEN_URL  = f'{GRAPH_API}/oauth/access_token'


def _h(token):
    return {'Authorization': f'Bearer {token}'}


# ─── Token ───────────────────────────────────────────────────────────────────

def exchange_code(code, redirect_uri):
    """Exchange OAuth code for a short-lived token, then get long-lived token."""
    resp = http_requests.get(TOKEN_URL, params={
        'client_id':     settings.META_APP_ID,
        'client_secret': settings.META_APP_SECRET,
        'redirect_uri':  redirect_uri,
        'code':          code,
    }, timeout=10)
    data = resp.json()
    if 'access_token' not in data:
        raise ValueError(data.get('error', {}).get('message', 'Token exchange failed'))
    short_token = data['access_token']

    # Exchange short-lived for long-lived (60-day)
    resp2 = http_requests.get(TOKEN_URL, params={
        'grant_type':       'fb_exchange_token',
        'client_id':        settings.META_APP_ID,
        'client_secret':    settings.META_APP_SECRET,
        'fb_exchange_token': short_token,
    }, timeout=10)
    data2 = resp2.json()
    return data2.get('access_token', short_token), data2.get('expires_in')


def get_me(token):
    resp = http_requests.get(f'{GRAPH_API}/me', params={'fields': 'id,name'}, headers=_h(token), timeout=10)
    return resp.json()


# ─── Ad Accounts ─────────────────────────────────────────────────────────────

def get_ad_accounts(token):
    resp = http_requests.get(
        f'{GRAPH_API}/me/adaccounts',
        params={'fields': 'id,name,account_status,currency', 'limit': 100},
        headers=_h(token), timeout=10,
    )
    data = resp.json()
    return data.get('data', [])


# ─── Pages ───────────────────────────────────────────────────────────────────

def get_pages(token):
    resp = http_requests.get(
        f'{GRAPH_API}/me/accounts',
        params={'fields': 'id,name,access_token', 'limit': 100},
        headers=_h(token), timeout=10,
    )
    data = resp.json()
    return data.get('data', [])


# ─── Campaigns & Ad Sets ──────────────────────────────────────────────────────

def get_campaigns(conn):
    resp = http_requests.get(
        f'{GRAPH_API}/{conn.ad_account_id}/campaigns',
        params={'fields': 'id,name,status,objective', 'limit': 100, 'filtering': '[{"field":"effective_status","operator":"IN","value":["ACTIVE","PAUSED"]}]'},
        headers=_h(conn.access_token), timeout=10,
    )
    data = resp.json()
    if 'error' in data:
        raise ValueError(data['error'].get('message', 'Campaigns fetch failed'))
    return data.get('data', [])


def get_adsets(conn, campaign_id):
    resp = http_requests.get(
        f'{GRAPH_API}/{campaign_id}/adsets',
        params={'fields': 'id,name,status', 'limit': 100},
        headers=_h(conn.access_token), timeout=10,
    )
    data = resp.json()
    if 'error' in data:
        raise ValueError(data['error'].get('message', 'Ad sets fetch failed'))
    return data.get('data', [])


# ─── Post Creative ────────────────────────────────────────────────────────────

def post_creative_to_meta(conn, creative, campaign_id, campaign_name, adset_id, adset_name):
    """
    Upload a GeneratedCreative image to Meta and create an ad.
    Returns a dict with ad_id, ad_creative_id, image_hash.
    """
    # 1. Download the image
    img_url = creative.logo_applied_url or creative.image_url
    if not img_url:
        raise ValueError('Creative has no image URL')

    r = http_requests.get(img_url, timeout=30)
    if not r.ok:
        raise ValueError(f'Failed to fetch image (HTTP {r.status_code})')
    img_bytes = r.content
    mime = r.headers.get('content-type', 'image/jpeg')
    ext = 'jpg' if 'jpeg' in mime or 'jpg' in mime else 'png'
    filename = f'{creative.name[:50]}.{ext}'

    # 2. Upload image to ad account
    upload_resp = http_requests.post(
        f'{GRAPH_API}/{conn.ad_account_id}/adimages',
        headers=_h(conn.access_token),
        files={'filename': (filename, io.BytesIO(img_bytes), mime)},
        timeout=60,
    )
    upload_data = upload_resp.json()
    if 'error' in upload_data:
        raise ValueError(upload_data['error'].get('message', 'Image upload failed'))

    images = upload_data.get('images', {})
    image_info = next(iter(images.values()), {})
    image_hash = image_info.get('hash', '')
    if not image_hash:
        raise ValueError('No image hash returned from Meta')

    # 3. Create AdCreative
    creative_resp = http_requests.post(
        f'{GRAPH_API}/{conn.ad_account_id}/adcreatives',
        headers={**_h(conn.access_token), 'Content-Type': 'application/json'},
        json={
            'name': creative.name[:90],
            'object_story_spec': {
                'page_id': conn.page_id,
                'link_data': {
                    'image_hash': image_hash,
                    'link': settings.SITE_BASE_URL,
                    'message': creative.name,
                    'call_to_action': {'type': 'LEARN_MORE'},
                },
            },
        },
        timeout=30,
    )
    creative_data = creative_resp.json()
    if 'error' in creative_data:
        raise ValueError(creative_data['error'].get('message', 'AdCreative creation failed'))
    ad_creative_id = creative_data.get('id', '')

    # 4. Create Ad (PAUSED — user activates from Meta Ads Manager)
    ad_resp = http_requests.post(
        f'{GRAPH_API}/{conn.ad_account_id}/ads',
        headers={**_h(conn.access_token), 'Content-Type': 'application/json'},
        json={
            'name': creative.name[:90],
            'adset_id': adset_id,
            'creative': {'creative_id': ad_creative_id},
            'status': 'PAUSED',
        },
        timeout=30,
    )
    ad_data = ad_resp.json()
    if 'error' in ad_data:
        raise ValueError(ad_data['error'].get('message', 'Ad creation failed'))
    ad_id = ad_data.get('id', '')

    return {
        'ad_id':          ad_id,
        'ad_creative_id': ad_creative_id,
        'image_hash':     image_hash,
        'campaign_id':    campaign_id,
        'campaign_name':  campaign_name,
        'adset_id':       adset_id,
        'adset_name':     adset_name,
    }


# ─── Metrics ─────────────────────────────────────────────────────────────────

def fetch_metrics(conn, ad_id):
    """Fetch lifetime insights for a single ad."""
    resp = http_requests.get(
        f'{GRAPH_API}/{ad_id}/insights',
        params={
            'fields': 'impressions,clicks,spend,ctr,cpm,reach',
            'date_preset': 'lifetime',
        },
        headers=_h(conn.access_token),
        timeout=15,
    )
    data = resp.json()
    if 'error' in data:
        raise ValueError(data['error'].get('message', 'Metrics fetch failed'))
    rows = data.get('data', [])
    if not rows:
        return None
    row = rows[0]
    return {
        'impressions': int(row.get('impressions', 0)),
        'clicks':      int(row.get('clicks', 0)),
        'spend':       float(row.get('spend', 0)),
        'ctr':         float(row.get('ctr', 0)),
        'cpm':         float(row.get('cpm', 0)),
        'reach':       int(row.get('reach', 0)),
    }


# ─── Tag helper ──────────────────────────────────────────────────────────────

def mark_meta_linked(creative):
    try:
        from apps.creatives.models import CreativeTag
        tag, _ = CreativeTag.objects.get_or_create(
            workspace=creative.workspace,
            name='Meta Linked',
            defaults={'color': '#1877F2'},
        )
        creative.tags.add(tag)
    except Exception:
        pass
