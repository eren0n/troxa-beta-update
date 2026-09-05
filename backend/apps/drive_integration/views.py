from urllib.parse import urlencode

import requests as http_requests

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.signing import Signer, BadSignature
from django.shortcuts import redirect
from django.utils import timezone
from datetime import timedelta

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from apps.accounts.views import get_workspace
from apps.activity.utils import log_event
from apps.creatives.models import GeneratedCreative
from .models import DriveConnection, DriveWorkspaceFolder
from .services import (
    list_drive_items, list_all_images_in_folder, download_drive_file,
    get_valid_token, manual_sync_creative,
)

GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
TOKEN_URL = 'https://oauth2.googleapis.com/token'
USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

DRIVE_SCOPES = ' '.join([
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.readonly',
    'openid',
    'email',
])


def _redirect_uri():
    return f'{settings.SITE_BASE_URL}/api/drive/oauth/callback/'


def _get_conn(request):
    """Return the current user's DriveConnection or None."""
    try:
        return request.user.drive_connection
    except DriveConnection.DoesNotExist:
        return None


class DriveInstallView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        signer = Signer()
        state = signer.sign(str(request.user.id))

        params = {
            'client_id': settings.GOOGLE_CLIENT_ID,
            'redirect_uri': _redirect_uri(),
            'response_type': 'code',
            'scope': DRIVE_SCOPES,
            'access_type': 'offline',
            'prompt': 'consent',
            'state': state,
        }
        return Response({'url': f'{GOOGLE_AUTH_URL}?{urlencode(params)}'})


class DriveOAuthCallbackView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        frontend_base = settings.SITE_BASE_URL
        code = request.GET.get('code')
        state = request.GET.get('state', '')
        error = request.GET.get('error')

        if error or not code:
            return redirect(f'{frontend_base}/dashboard/integrations?drive=cancelled')

        signer = Signer()
        try:
            user_id = signer.unsign(state)
        except BadSignature:
            return redirect(f'{frontend_base}/dashboard/integrations?drive=error')

        # Exchange code for tokens
        resp = http_requests.post(TOKEN_URL, data={
            'code': code,
            'client_id': settings.GOOGLE_CLIENT_ID,
            'client_secret': settings.GOOGLE_CLIENT_SECRET,
            'redirect_uri': _redirect_uri(),
            'grant_type': 'authorization_code',
        }, timeout=10)
        data = resp.json()

        if 'access_token' not in data or 'refresh_token' not in data:
            return redirect(f'{frontend_base}/dashboard/integrations?drive=error')

        # Get user email from Google
        user_resp = http_requests.get(
            USERINFO_URL,
            headers={'Authorization': f'Bearer {data["access_token"]}'},
            timeout=10,
        )
        email = user_resp.json().get('email', '')
        expiry = timezone.now() + timedelta(seconds=data.get('expires_in', 3600))

        from apps.accounts.models import User
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return redirect(f'{frontend_base}/dashboard/integrations?drive=error')

        DriveConnection.objects.update_or_create(
            user=user,
            defaults={
                'drive_email': email,
                'access_token': data['access_token'],
                'refresh_token': data['refresh_token'],
                'token_expiry': expiry,
                'generations_folder_id': '',
            },
        )

        return redirect(f'{frontend_base}/dashboard/integrations?drive=connected&email={email}')


class DriveStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        conn = _get_conn(request)
        if not conn:
            return Response({'connected': False})
        return Response({
            'connected': True,
            'drive_email': conn.drive_email,
            'auto_sync': conn.auto_sync,
            'connected_at': conn.connected_at,
        })


class DriveDisconnectView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        conn = _get_conn(request)
        if conn:
            conn.delete()
        return Response({'detail': 'Disconnected.'})


class DriveAutoSyncToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        conn = _get_conn(request)
        if not conn:
            return Response(status=404)
        conn.auto_sync = bool(request.data.get('auto_sync', conn.auto_sync))
        conn.save(update_fields=['auto_sync'])
        return Response({'auto_sync': conn.auto_sync})


class DriveFilesView(APIView):
    """List folders + images in a given Drive folder (root if no folder_id)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        conn = _get_conn(request)
        if not conn:
            return Response({'detail': 'Drive not connected.'}, status=400)
        try:
            result = list_drive_items(
                conn,
                folder_id=request.query_params.get('folder_id') or None,
                page_token=request.query_params.get('page_token'),
                search=request.query_params.get('q', ''),
            )
            return Response(result)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


class DriveFolderImagesView(APIView):
    """Return all image file IDs + thumbnails inside a folder (recursive)."""
    permission_classes = [IsAuthenticated]

    def get(self, request, folder_id):
        conn = _get_conn(request)
        if not conn:
            return Response({'detail': 'Drive not connected.'}, status=400)
        try:
            images = list_all_images_in_folder(conn, folder_id)
            return Response({'items': images})
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


class DriveImportView(APIView):
    """Import selected Drive files as creatives (usable as reference photos)."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ws = get_workspace(request)
        if not ws:
            return Response(status=404)
        conn = _get_conn(request)
        if not conn:
            return Response({'detail': 'Drive not connected.'}, status=400)

        file_ids = request.data.get('file_ids', [])
        if not file_ids:
            return Response({'detail': 'No file IDs provided.'}, status=400)

        imported = []
        errors = []

        for file_id in file_ids[:20]:
            try:
                meta, content = download_drive_file(conn, file_id)
                name = meta.get('name', file_id)
                creative = GeneratedCreative(
                    workspace=ws, name=name, media_type='Photo',
                    source='uploaded', uploaded_by=request.user,
                    in_gallery=True, created_by=request.user,
                )
                ext = name.rsplit('.', 1)[-1] if '.' in name else 'png'
                creative.uploaded_file.save(f'drive_{file_id}.{ext}', ContentFile(content), save=False)
                creative.image_url = request.build_absolute_uri(creative.uploaded_file.url)
                creative.save()
                imported.append({'id': creative.id, 'name': creative.name})
                log_event(ws, request.user, 'drive_import', f'Imported "{name}" from Drive')
            except Exception as e:
                errors.append({'file_id': file_id, 'error': str(e)})

        return Response({'imported': imported, 'errors': errors})


class DriveFolderConfigView(APIView):
    """
    GET  /api/drive/folder-config/  — return sync toggles + custom folder IDs
    PATCH /api/drive/folder-config/ — update toggles and/or custom folder IDs
    """
    permission_classes = [IsAuthenticated]

    def _get_wf(self, request):
        ws = get_workspace(request)
        if not ws:
            return None, None
        conn = _get_conn(request)
        if not conn:
            return None, None
        wf, _ = DriveWorkspaceFolder.objects.get_or_create(connection=conn, workspace=ws)
        return conn, wf

    def get(self, request):
        conn, wf = self._get_wf(request)
        if wf is None:
            return Response({'detail': 'Drive not connected.'}, status=400)
        return Response(self._serialize(conn, wf))

    def patch(self, request):
        conn, wf = self._get_wf(request)
        if wf is None:
            return Response({'detail': 'Drive not connected.'}, status=400)

        bool_fields = ('sync_creatives', 'sync_videos', 'sync_logos')
        str_fields  = ('custom_images_folder_id', 'custom_videos_folder_id', 'custom_logos_folder_id')
        changed = []

        for f in bool_fields:
            if f in request.data:
                setattr(wf, f, bool(request.data[f]))
                changed.append(f)
        for f in str_fields:
            if f in request.data:
                setattr(wf, f, str(request.data[f]).strip())
                changed.append(f)

        if changed:
            wf.save(update_fields=changed)
        return Response(self._serialize(conn, wf))

    @staticmethod
    def _serialize(conn, wf):
        return {
            'auto_sync':               conn.auto_sync,
            'sync_creatives':          wf.sync_creatives,
            'sync_videos':             wf.sync_videos,
            'sync_logos':              wf.sync_logos,
            'custom_images_folder_id': wf.custom_images_folder_id,
            'custom_videos_folder_id': wf.custom_videos_folder_id,
            'custom_logos_folder_id':  wf.custom_logos_folder_id,
            'images_folder_id':        wf.images_folder_id,
            'videos_folder_id':        wf.videos_folder_id,
            'logos_folder_id':         wf.logos_folder_id,
        }


class DriveUploadCreativeView(APIView):
    """
    POST /api/drive/upload-creative/
    Body: { creative_id: <uuid> }
    Manually sync a single creative to Drive.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ws = get_workspace(request)
        if not ws:
            return Response(status=404)
        conn = _get_conn(request)
        if not conn:
            return Response({'detail': 'Drive not connected.'}, status=400)

        creative_id = request.data.get('creative_id')
        if not creative_id:
            return Response({'detail': 'creative_id required'}, status=400)

        creative = ws.creatives.filter(id=creative_id).first()
        if not creative:
            return Response({'detail': 'Creative not found'}, status=404)

        result = manual_sync_creative(request.user, ws, creative)
        if result['ok']:
            return Response(result)
        return Response({'detail': result.get('error', 'Upload failed')}, status=400)
