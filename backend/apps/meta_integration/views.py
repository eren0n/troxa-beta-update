from urllib.parse import urlencode

from django.conf import settings
from django.core.signing import Signer, BadSignature
from django.shortcuts import redirect
from django.utils import timezone
from datetime import timedelta

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from apps.accounts.views import get_workspace
from .models import MetaConnection, MetaCreativeLink
from . import services

OAUTH_URL = 'https://www.facebook.com/v20.0/dialog/oauth'
SCOPES    = 'ads_management,ads_read,pages_show_list'


def _redirect_uri():
    return f'{settings.SITE_BASE_URL}/api/meta/oauth/callback/'


class MetaInstallView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        if not ws:
            return Response(status=404)
        signer = Signer()
        state  = signer.sign(str(ws.id))
        params = {
            'client_id':    settings.META_APP_ID,
            'redirect_uri': _redirect_uri(),
            'scope':        SCOPES,
            'state':        state,
            'response_type': 'code',
        }
        return Response({'url': f'{OAUTH_URL}?{urlencode(params)}'})


class MetaOAuthCallbackView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        frontend_base = settings.SITE_BASE_URL
        code  = request.GET.get('code')
        state = request.GET.get('state', '')
        error = request.GET.get('error')

        if error or not code:
            return redirect(f'{frontend_base}/dashboard/integrations?meta=cancelled')

        signer = Signer()
        try:
            workspace_id = signer.unsign(state)
        except BadSignature:
            return redirect(f'{frontend_base}/dashboard/integrations?meta=error')

        try:
            from apps.accounts.models import Workspace
            ws = Workspace.objects.get(id=workspace_id)
        except Exception:
            return redirect(f'{frontend_base}/dashboard/integrations?meta=error')

        try:
            token, expires_in = services.exchange_code(code, _redirect_uri())
            me = services.get_me(token)

            expires_at = None
            if expires_in:
                expires_at = timezone.now() + timedelta(seconds=int(expires_in))

            MetaConnection.objects.update_or_create(
                workspace=ws,
                defaults={
                    'access_token':     token,
                    'token_expires_at': expires_at,
                    'fb_user_id':       me.get('id', ''),
                    'fb_user_name':     me.get('name', ''),
                    # Reset account/page so user goes through setup again
                    'ad_account_id':    '',
                    'ad_account_name':  '',
                    'page_id':          '',
                    'page_name':        '',
                },
            )
        except Exception as e:
            return redirect(f'{frontend_base}/dashboard/integrations?meta=error&msg={str(e)[:80]}')

        return redirect(f'{frontend_base}/dashboard/integrations?meta=connected')


class MetaStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        if not ws:
            return Response(status=404)
        try:
            conn = ws.meta_connection
        except MetaConnection.DoesNotExist:
            return Response({'connected': False})

        return Response({
            'connected':        True,
            'fb_user_name':     conn.fb_user_name,
            'ad_account_id':    conn.ad_account_id,
            'ad_account_name':  conn.ad_account_name,
            'page_id':          conn.page_id,
            'page_name':        conn.page_name,
            'setup_complete':   conn.setup_complete,
        })


class MetaDisconnectView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        ws = get_workspace(request)
        if not ws:
            return Response(status=404)
        MetaConnection.objects.filter(workspace=ws).delete()
        return Response({'detail': 'Disconnected.'})


class MetaAdAccountsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        try:
            conn = ws.meta_connection
        except MetaConnection.DoesNotExist:
            return Response({'error': 'Meta not connected'}, status=400)
        try:
            accounts = services.get_ad_accounts(conn.access_token)
            return Response({'accounts': accounts})
        except Exception as e:
            return Response({'error': str(e)}, status=502)

    def patch(self, request):
        """Set the selected ad account."""
        ws = get_workspace(request)
        try:
            conn = ws.meta_connection
        except MetaConnection.DoesNotExist:
            return Response({'error': 'Meta not connected'}, status=400)
        conn.ad_account_id   = request.data.get('ad_account_id', '').strip()
        conn.ad_account_name = request.data.get('ad_account_name', '').strip()
        conn.save(update_fields=['ad_account_id', 'ad_account_name'])
        return Response({'ok': True})


class MetaPagesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        try:
            conn = ws.meta_connection
        except MetaConnection.DoesNotExist:
            return Response({'error': 'Meta not connected'}, status=400)
        try:
            pages = services.get_pages(conn.access_token)
            return Response({'pages': pages})
        except Exception as e:
            return Response({'error': str(e)}, status=502)

    def patch(self, request):
        """Set the selected Facebook page."""
        ws = get_workspace(request)
        try:
            conn = ws.meta_connection
        except MetaConnection.DoesNotExist:
            return Response({'error': 'Meta not connected'}, status=400)
        conn.page_id   = request.data.get('page_id', '').strip()
        conn.page_name = request.data.get('page_name', '').strip()
        conn.save(update_fields=['page_id', 'page_name'])
        return Response({'ok': True})


class MetaCampaignsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        try:
            conn = ws.meta_connection
        except MetaConnection.DoesNotExist:
            return Response({'error': 'Meta not connected'}, status=400)
        if not conn.ad_account_id:
            return Response({'error': 'No ad account selected'}, status=400)
        try:
            campaigns = services.get_campaigns(conn)
            return Response({'campaigns': campaigns})
        except Exception as e:
            return Response({'error': str(e)}, status=502)


class MetaAdsetsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        campaign_id = request.query_params.get('campaign_id', '').strip()
        if not campaign_id:
            return Response({'error': 'campaign_id required'}, status=400)
        try:
            conn = ws.meta_connection
        except MetaConnection.DoesNotExist:
            return Response({'error': 'Meta not connected'}, status=400)
        try:
            adsets = services.get_adsets(conn, campaign_id)
            return Response({'adsets': adsets})
        except Exception as e:
            return Response({'error': str(e)}, status=502)


class MetaPostCreativeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ws = get_workspace(request)
        try:
            conn = ws.meta_connection
        except MetaConnection.DoesNotExist:
            return Response({'error': 'Meta not connected'}, status=400)
        if not conn.setup_complete:
            return Response({'error': 'Meta setup not complete'}, status=400)

        creative_id   = request.data.get('creative_id')
        campaign_id   = request.data.get('campaign_id', '').strip()
        campaign_name = request.data.get('campaign_name', '').strip()
        adset_id      = request.data.get('adset_id', '').strip()
        adset_name    = request.data.get('adset_name', '').strip()

        if not all([creative_id, campaign_id, adset_id]):
            return Response({'error': 'creative_id, campaign_id, adset_id required'}, status=400)

        creative = ws.creatives.filter(id=creative_id).first()
        if not creative:
            return Response({'error': 'Creative not found'}, status=404)

        try:
            result = services.post_creative_to_meta(
                conn, creative, campaign_id, campaign_name, adset_id, adset_name
            )
        except Exception as e:
            return Response({'error': str(e)}, status=502)

        link, _ = MetaCreativeLink.objects.update_or_create(
            creative=creative,
            defaults=result,
        )

        services.mark_meta_linked(creative)

        return Response({
            'ok':          True,
            'ad_id':       link.ad_id,
            'campaign':    link.campaign_name,
            'adset':       link.adset_name,
        })


class MetaMetricsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, creative_id):
        ws = get_workspace(request)
        creative = ws.creatives.filter(id=creative_id).first()
        if not creative:
            return Response(status=404)

        try:
            link = creative.meta_link
        except MetaCreativeLink.DoesNotExist:
            return Response({'linked': False})

        if not link.ad_id:
            return Response({'linked': True, 'metrics': None})

        try:
            conn = ws.meta_connection
        except MetaConnection.DoesNotExist:
            return Response({'error': 'Meta not connected'}, status=400)

        try:
            metrics = services.fetch_metrics(conn, link.ad_id)
        except Exception as e:
            # Return cached metrics if live fetch fails
            metrics = None

        if metrics:
            link.impressions = metrics['impressions']
            link.clicks      = metrics['clicks']
            link.spend       = metrics['spend']
            link.ctr         = metrics['ctr']
            link.cpm         = metrics['cpm']
            link.reach       = metrics['reach']
            link.metrics_updated_at = timezone.now()
            link.save(update_fields=['impressions','clicks','spend','ctr','cpm','reach','metrics_updated_at'])
        else:
            metrics = {
                'impressions': link.impressions,
                'clicks':      link.clicks,
                'spend':       float(link.spend),
                'ctr':         float(link.ctr),
                'cpm':         float(link.cpm),
                'reach':       link.reach,
            }

        return Response({
            'linked':       True,
            'ad_id':        link.ad_id,
            'campaign':     link.campaign_name,
            'adset':        link.adset_name,
            'linked_at':    link.linked_at,
            'metrics':      metrics,
            'updated_at':   link.metrics_updated_at,
        })
