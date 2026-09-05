import os
import requests
from rest_framework.views import APIView
from rest_framework.response import Response
from .mgmt_views import IsRMGSAdmin, _require_tab

META_API_VERSION = 'v19.0'
META_GRAPH_URL = f'https://graph.facebook.com/{META_API_VERSION}'

# Map Meta action_type keys to our field names
ACTION_COMPLETE_REG = [
    'offsite_conversion.fb_pixel_complete_registration',
    'complete_registration',
]
ACTION_CHECKOUT = [
    'offsite_conversion.fb_pixel_initiate_checkout',
    'initiate_checkout',
]
ACTION_PURCHASE = [
    'offsite_conversion.fb_pixel_purchase',
    'purchase',
    'omni_purchase',
]


def _pick_action(actions, keys):
    """Sum values for any matching action_type keys."""
    if not actions:
        return 0.0
    total = 0.0
    for a in actions:
        if a.get('action_type') in keys:
            try:
                total += float(a.get('value', 0))
            except (ValueError, TypeError):
                pass
    return total


def _safe_div(a, b):
    return round(a / b, 2) if b else 0.0


def _process_ad(ad, date_preset):
    name = ad.get('name', '—')
    status = ad.get('status', '—')
    creative = ad.get('creative', {})
    thumbnail_url = creative.get('thumbnail_url') or creative.get('image_url') or None

    insights_data = ad.get('insights', {}).get('data', [])
    if not insights_data:
        return {
            'id': ad.get('id'),
            'name': name,
            'status': status,
            'thumbnail_url': thumbnail_url,
            'spend': 0,
            'impressions': 0,
            'reach': 0,
            'ctr': 0,
            'regs': 0,
            'checkouts': 0,
            'purchases': 0,
            'cost_per_reg': 0,
            'cost_per_checkout': 0,
            'cost_per_purchase': 0,
            'roas': 0,
            'reg_to_ftp_pct': 0,
            'reg_to_purchase_pct': 0,
        }

    ins = insights_data[0]
    spend = float(ins.get('spend', 0) or 0)
    impressions = int(ins.get('impressions', 0) or 0)
    reach = int(ins.get('reach', 0) or 0)
    ctr = float(ins.get('ctr', 0) or 0)

    actions = ins.get('actions', [])
    action_values = ins.get('action_values', [])

    regs = _pick_action(actions, ACTION_COMPLETE_REG)
    checkouts = _pick_action(actions, ACTION_CHECKOUT)
    purchases = _pick_action(actions, ACTION_PURCHASE)

    # ROAS — prefer Meta's own purchase_roas field, fall back to action_values
    roas_list = ins.get('purchase_roas', [])
    if roas_list:
        try:
            roas = round(float(roas_list[0].get('value', 0)), 2)
        except (ValueError, TypeError, IndexError):
            roas = 0.0
    else:
        purchase_value = _pick_action(action_values, ACTION_PURCHASE)
        roas = _safe_div(purchase_value, spend)

    return {
        'id': ad.get('id'),
        'name': name,
        'status': status,
        'thumbnail_url': thumbnail_url,
        'spend': round(spend, 2),
        'impressions': impressions,
        'reach': reach,
        'ctr': round(ctr, 2),
        'regs': int(regs),
        'checkouts': int(checkouts),
        'purchases': int(purchases),
        'cost_per_reg': _safe_div(spend, regs),
        'cost_per_checkout': _safe_div(spend, checkouts),
        'cost_per_purchase': _safe_div(spend, purchases),
        'roas': roas,
        'reg_to_ftp_pct': round(_safe_div(checkouts, regs) * 100, 1),
        'reg_to_purchase_pct': round(_safe_div(purchases, regs) * 100, 1),
    }


def _fetch_ad_accounts(token):
    """
    Return list of {id, name} ad accounts for this token.
    Tries /me/adaccounts first (user tokens), then falls back to
    /me/businesses → owned_ad_accounts (system user tokens).
    """
    # Attempt 1: direct user ad accounts
    resp = requests.get(
        f'{META_GRAPH_URL}/me/adaccounts',
        params={'fields': 'id,name,account_id', 'access_token': token, 'limit': 50},
        timeout=15,
    )
    data = resp.json()
    if 'error' in data:
        return None, data['error'].get('message', 'Meta API error')

    accounts = [
        {'id': a['account_id'], 'name': a.get('name', a['account_id'])}
        for a in data.get('data', [])
    ]
    if accounts:
        return accounts, None

    # Attempt 2: system user — get via businesses
    biz_resp = requests.get(
        f'{META_GRAPH_URL}/me/businesses',
        params={'fields': 'id,name', 'access_token': token, 'limit': 10},
        timeout=15,
    )
    biz_data = biz_resp.json()
    if 'error' in biz_data:
        return [], None  # no businesses either, return empty without error

    for biz in biz_data.get('data', []):
        biz_id = biz['id']
        for endpoint in ('owned_ad_accounts', 'client_ad_accounts'):
            r = requests.get(
                f'{META_GRAPH_URL}/{biz_id}/{endpoint}',
                params={'fields': 'id,name,account_id', 'access_token': token, 'limit': 50},
                timeout=15,
            )
            d = r.json()
            for a in d.get('data', []):
                acct_id = a.get('account_id') or a.get('id', '').replace('act_', '')
                name = a.get('name', acct_id)
                if acct_id and not any(x['id'] == acct_id for x in accounts):
                    accounts.append({'id': acct_id, 'name': name})

    return accounts, None


class MetaAdsAccountsView(APIView):
    """Return ad accounts linked to the token (for account picker)."""
    permission_classes = [IsRMGSAdmin]

    def get(self, request):
        guard = _require_tab(request.user, 'meta')
        if guard: return guard
        token = os.environ.get('META_ADS_ACCESS_TOKEN', '').strip()
        if not token:
            return Response({'error': 'META_ADS_ACCESS_TOKEN not configured'}, status=503)
        accounts, err = _fetch_ad_accounts(token)
        if err:
            return Response({'error': err}, status=400)
        return Response({'accounts': accounts})


class MetaAdsDebugView(APIView):
    """Raw debug — shows exactly what Meta API returns for this token."""
    permission_classes = [IsRMGSAdmin]

    def get(self, request):
        guard = _require_tab(request.user, 'meta')
        if guard:
            return guard
        token = os.environ.get('META_ADS_ACCESS_TOKEN', '').strip()
        if not token:
            return Response({'error': 'META_ADS_ACCESS_TOKEN not configured'}, status=503)

        out = {}

        # 1. /me
        r = requests.get(f'{META_GRAPH_URL}/me', params={'access_token': token, 'fields': 'id,name,type'}, timeout=10)
        out['me'] = r.json()

        # 2. /me/adaccounts
        r = requests.get(f'{META_GRAPH_URL}/me/adaccounts', params={'access_token': token, 'fields': 'id,name,account_id,account_status', 'limit': 50}, timeout=10)
        out['me_adaccounts'] = r.json()

        # 3. /me/businesses
        r = requests.get(f'{META_GRAPH_URL}/me/businesses', params={'access_token': token, 'fields': 'id,name', 'limit': 10}, timeout=10)
        out['me_businesses'] = r.json()

        # 4. If businesses found, try owned_ad_accounts on first one
        businesses = out['me_businesses'].get('data', [])
        out['business_ad_accounts'] = {}
        for biz in businesses[:3]:
            biz_id = biz['id']
            r = requests.get(f'{META_GRAPH_URL}/{biz_id}/owned_ad_accounts', params={'access_token': token, 'fields': 'id,name,account_id', 'limit': 50}, timeout=10)
            out['business_ad_accounts'][f'{biz_id}_owned'] = r.json()
            r = requests.get(f'{META_GRAPH_URL}/{biz_id}/client_ad_accounts', params={'access_token': token, 'fields': 'id,name,account_id', 'limit': 50}, timeout=10)
            out['business_ad_accounts'][f'{biz_id}_client'] = r.json()

        return Response(out)


class MetaAdsView(APIView):
    permission_classes = [IsRMGSAdmin]

    def get(self, request):
        guard = _require_tab(request.user, 'meta')
        if guard: return guard
        token = os.environ.get('META_ADS_ACCESS_TOKEN', '').strip()
        if not token:
            return Response({'error': 'META_ADS_ACCESS_TOKEN not configured'}, status=503)

        # Account ID: prefer query param, then env, then auto-detect first account
        account_id = (
            request.query_params.get('account_id')
            or os.environ.get('META_ADS_ACCOUNT_ID', '').strip()
        )
        if not account_id:
            accounts, err = _fetch_ad_accounts(token)
            if err:
                return Response({'error': err}, status=400)
            if not accounts:
                return Response({'error': 'No ad accounts found for this token'}, status=400)
            account_id = accounts[0]['id']

        date_preset = request.query_params.get('date_preset', 'last_30d')

        fields = (
            'name,status,'
            'insights.date_preset(' + date_preset + '){'
            'spend,impressions,reach,ctr,'
            'actions,action_values,purchase_roas'
            '}'
        )
        params = {
            'fields': fields,
            'access_token': token,
            'limit': 200,
        }

        url = f'{META_GRAPH_URL}/act_{account_id}/ads'
        try:
            resp = requests.get(url, params=params, timeout=30)
            data = resp.json()
        except requests.RequestException as e:
            return Response({'error': f'Meta API request failed: {str(e)}'}, status=502)

        if 'error' in data:
            return Response({'error': data['error'].get('message', 'Meta API error')}, status=400)

        ads_raw = data.get('data', [])
        processed = [_process_ad(ad, date_preset) for ad in ads_raw]
        processed.sort(key=lambda x: x['spend'], reverse=True)

        return Response({
            'account_id': account_id,
            'date_preset': date_preset,
            'count': len(processed),
            'ads': processed,
        })


class AdCreativeView(APIView):
    """Fetch creative for a single ad on demand. Returns JSON for video, proxied binary for images."""
    permission_classes = [IsRMGSAdmin]

    def get(self, request, ad_id):
        guard = _require_tab(request.user, 'meta')
        if guard: return guard
        token = os.environ.get('META_ADS_ACCESS_TOKEN', '').strip()
        if not token:
            return Response({'error': 'META_ADS_ACCESS_TOKEN not configured'}, status=400)
        try:
            resp = requests.get(
                f'{META_GRAPH_URL}/{ad_id}',
                params={'fields': 'creative{image_url,thumbnail_url,video_id}', 'access_token': token},
                timeout=10,
            )
            data = resp.json()
        except requests.RequestException as e:
            return Response({'error': str(e)}, status=502)
        if 'error' in data:
            return Response({'error': data['error'].get('message', 'Meta API error')}, status=400)

        creative = data.get('creative', {})
        video_id = creative.get('video_id')
        creative_id = creative.get('id')

        # If video_id not directly available, query the creative object itself
        if not video_id and creative_id:
            try:
                c_resp = requests.get(
                    f'{META_GRAPH_URL}/{creative_id}',
                    params={'fields': 'video_id,object_story_spec', 'access_token': token},
                    timeout=10,
                )
                c_data = c_resp.json()
                video_id = c_data.get('video_id')
                if not video_id:
                    # Try nested in object_story_spec
                    spec = c_data.get('object_story_spec', {})
                    video_id = (
                        spec.get('video_data', {}).get('video_id')
                        or spec.get('link_data', {}).get('child_attachments', [{}])[0].get('video_id')
                    )
            except Exception:
                pass

        # Debug mode: return raw creative data
        if request.query_params.get('debug') == '1':
            return Response({'raw_ad': data, 'creative': creative, 'creative_id': creative_id, 'video_id': video_id})

        # Video creative — fetch actual video source + thumbnail from Meta
        if video_id:
            try:
                v_resp = requests.get(
                    f'{META_GRAPH_URL}/{video_id}',
                    params={'fields': 'source,picture,embed_html,thumbnails', 'access_token': token},
                    timeout=10,
                )
                v_data = v_resp.json()
            except requests.RequestException:
                v_data = {}

            video_url = v_data.get('source') or None
            embed_html = v_data.get('embed_html') or None

            # Get best thumbnail
            poster_url = v_data.get('picture') or None
            thumbnails = v_data.get('thumbnails', {}).get('data', [])
            if thumbnails:
                best = max(thumbnails, key=lambda t: t.get('width', 0))
                poster_url = best.get('uri') or poster_url

            if video_url:
                return Response({'media_type': 'video', 'video_url': video_url, 'poster_url': poster_url})

            # No source but embed_html available — return iframe embed
            if embed_html:
                return Response({'media_type': 'embed', 'embed_html': embed_html, 'poster_url': poster_url})

            # Fallback — proxy the best thumbnail we have
            proxy_url = poster_url or creative.get('image_url') or None
            if proxy_url:
                try:
                    img_resp = requests.get(proxy_url, timeout=15, headers={'User-Agent': 'Mozilla/5.0'})
                    from django.http import HttpResponse
                    ct = img_resp.headers.get('Content-Type', 'image/jpeg')
                    return HttpResponse(img_resp.content, content_type=ct)
                except Exception:
                    pass
            return Response({'media_type': 'none'})

        # Image creative — proxy binary to avoid CORS
        image_url = creative.get('image_url') or creative.get('thumbnail_url') or None
        if not image_url:
            return Response({'media_type': 'none'})
        try:
            img_resp = requests.get(image_url, timeout=15, headers={'User-Agent': 'Mozilla/5.0'})
            from django.http import HttpResponse
            content_type = img_resp.headers.get('Content-Type', '')
            if not content_type or content_type.startswith('application/octet-stream'):
                lower = image_url.lower().split('?')[0]
                content_type = 'video/mp4' if lower.endswith(('.mp4', '.mov', '.webm')) else (
                    'image/png' if lower.endswith('.png') else 'image/jpeg'
                )
            return HttpResponse(img_resp.content, content_type=content_type)
        except Exception:
            return Response({'media_type': 'none'})
