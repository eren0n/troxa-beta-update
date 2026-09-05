"""
Google Drive API helpers.
Uses only `requests` — no extra Google SDK needed.
"""
import io
import os
import json
import logging
import requests as http_requests

logger = logging.getLogger(__name__)

from django.conf import settings
from django.utils import timezone
from datetime import timedelta

DRIVE_API = 'https://www.googleapis.com/drive/v3'
UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
TOKEN_URL = 'https://oauth2.googleapis.com/token'
FOLDER_MIME = 'application/vnd.google-apps.folder'

ROOT_FOLDER_NAME = 'Troxa.ai'
SUBFOLDER_IMAGES = 'Images'
SUBFOLDER_VIDEOS = 'Videos'
SUBFOLDER_LOGOS = 'With Logo'


# ─── Token management ────────────────────────────────────────────────────────

def get_valid_token(conn):
    """Return a valid access token, refreshing if needed."""
    if conn.token_expiry and timezone.now() < conn.token_expiry - timedelta(seconds=60):
        return conn.access_token

    resp = http_requests.post(TOKEN_URL, data={
        'client_id': settings.GOOGLE_CLIENT_ID,
        'client_secret': settings.GOOGLE_CLIENT_SECRET,
        'refresh_token': conn.refresh_token,
        'grant_type': 'refresh_token',
    }, timeout=10)

    data = resp.json()
    if 'access_token' not in data:
        raise ValueError('Drive token refresh failed')

    conn.access_token = data['access_token']
    conn.token_expiry = timezone.now() + timedelta(seconds=data.get('expires_in', 3600))
    conn.save(update_fields=['access_token', 'token_expiry'])
    return conn.access_token


def _auth(conn):
    return {'Authorization': f'Bearer {get_valid_token(conn)}'}


# ─── Folder management ───────────────────────────────────────────────────────

def _find_or_create_folder(conn, name, parent_id=None):
    """Find a folder by name (optionally under parent_id), create if missing."""
    parent_clause = f"and '{parent_id}' in parents" if parent_id else "and 'root' in parents"
    resp = http_requests.get(
        f'{DRIVE_API}/files',
        headers=_auth(conn),
        params={
            'q': f"name='{name}' and mimeType='{FOLDER_MIME}' and trashed=false {parent_clause}",
            'fields': 'files(id)',
            'pageSize': 1,
        },
        timeout=10,
    )
    files = resp.json().get('files', [])
    if files:
        return files[0]['id']

    body = {'name': name, 'mimeType': FOLDER_MIME}
    if parent_id:
        body['parents'] = [parent_id]
    r = http_requests.post(
        f'{DRIVE_API}/files',
        headers={**_auth(conn), 'Content-Type': 'application/json'},
        json=body,
        timeout=10,
    )
    return r.json().get('id', '')


def get_or_create_workspace_folders(conn, workspace):
    """
    Ensure Troxa.ai/{workspace_name}/Images|Videos|With Logo exist.
    Returns (images_folder_id, videos_folder_id, logos_folder_id).
    Custom override IDs (if set) take priority over auto-created ones.
    Caches IDs in DriveWorkspaceFolder.
    """
    from .models import DriveWorkspaceFolder

    wf, _ = DriveWorkspaceFolder.objects.get_or_create(connection=conn, workspace=workspace)

    # If all auto IDs are cached and no custom overrides, return early
    if wf.images_folder_id and wf.videos_folder_id and wf.logos_folder_id:
        return (
            wf.custom_images_folder_id or wf.images_folder_id,
            wf.custom_videos_folder_id or wf.videos_folder_id,
            wf.custom_logos_folder_id  or wf.logos_folder_id,
        )

    # 1. Root "Troxa.ai" folder
    if not conn.root_folder_id:
        conn.root_folder_id = _find_or_create_folder(conn, ROOT_FOLDER_NAME)
        conn.save(update_fields=['root_folder_id'])
    root_id = conn.root_folder_id

    # 2. Workspace subfolder
    if not wf.workspace_folder_id:
        wf.workspace_folder_id = _find_or_create_folder(conn, workspace.name, root_id)
    ws_id = wf.workspace_folder_id

    # 3. Subfolders
    if not wf.images_folder_id:
        wf.images_folder_id = _find_or_create_folder(conn, SUBFOLDER_IMAGES, ws_id)
    if not wf.videos_folder_id:
        wf.videos_folder_id = _find_or_create_folder(conn, SUBFOLDER_VIDEOS, ws_id)
    if not wf.logos_folder_id:
        wf.logos_folder_id = _find_or_create_folder(conn, SUBFOLDER_LOGOS, ws_id)

    wf.save(update_fields=['workspace_folder_id', 'images_folder_id', 'videos_folder_id', 'logos_folder_id'])
    return (
        wf.custom_images_folder_id or wf.images_folder_id,
        wf.custom_videos_folder_id or wf.videos_folder_id,
        wf.custom_logos_folder_id  or wf.logos_folder_id,
    )


# ─── List files ──────────────────────────────────────────────────────────────

def list_drive_items(conn, folder_id=None, page_token=None, search=''):
    """
    Return folders + images in a given folder (root if folder_id is None).
    Each item has: id, name, mimeType, thumbnailLink, isFolder.
    """
    parent = folder_id or 'root'

    if search:
        q = f"(mimeType contains 'image/' or mimeType='{FOLDER_MIME}') and name contains '{search}' and trashed=false"
    else:
        q = f"'{parent}' in parents and (mimeType contains 'image/' or mimeType='{FOLDER_MIME}') and trashed=false"

    params = {
        'q': q,
        'fields': 'nextPageToken,files(id,name,mimeType,size,thumbnailLink,createdTime)',
        'pageSize': 100,
        'orderBy': 'folder,name',
    }
    if page_token:
        params['pageToken'] = page_token

    resp = http_requests.get(
        f'{DRIVE_API}/files',
        headers=_auth(conn),
        params=params,
        timeout=15,
    )
    data = resp.json()
    items = []
    for f in data.get('files', []):
        items.append({
            **f,
            'isFolder': f.get('mimeType') == FOLDER_MIME,
        })
    return {
        'items': items,
        'next_page_token': data.get('nextPageToken'),
    }


def list_all_images_in_folder(conn, folder_id):
    """Recursively collect all image file ids + names inside a folder."""
    results = []
    page_token = None
    while True:
        q = f"'{folder_id}' in parents and trashed=false"
        params = {
            'q': q,
            'fields': 'nextPageToken,files(id,name,mimeType,thumbnailLink)',
            'pageSize': 200,
        }
        if page_token:
            params['pageToken'] = page_token
        resp = http_requests.get(f'{DRIVE_API}/files', headers=_auth(conn), params=params, timeout=15)
        data = resp.json()
        for f in data.get('files', []):
            if f.get('mimeType') == FOLDER_MIME:
                results.extend(list_all_images_in_folder(conn, f['id']))
            elif 'image/' in f.get('mimeType', ''):
                results.append(f)
        page_token = data.get('nextPageToken')
        if not page_token:
            break
    return results


def list_drive_images(conn, page_token=None, search=''):
    result = list_drive_items(conn, page_token=page_token, search=search)
    return {'files': [i for i in result['items'] if not i['isFolder']], 'next_page_token': result['next_page_token']}


# ─── Download & import ───────────────────────────────────────────────────────

def download_drive_file(conn, file_id):
    """Download file bytes + metadata from Drive."""
    meta_resp = http_requests.get(
        f'{DRIVE_API}/files/{file_id}',
        headers=_auth(conn),
        params={'fields': 'id,name,mimeType'},
        timeout=10,
    )
    meta = meta_resp.json()

    content_resp = http_requests.get(
        f'{DRIVE_API}/files/{file_id}',
        headers=_auth(conn),
        params={'alt': 'media'},
        timeout=30,
        stream=True,
    )
    content_resp.raise_for_status()
    return meta, content_resp.content


# ─── Upload to Drive ─────────────────────────────────────────────────────────

def upload_to_drive(conn, filename, content_bytes, mime_type='image/png', folder_id=None):
    """Upload bytes to Drive, optionally into a folder. Returns file metadata."""
    metadata = {'name': filename}
    if folder_id:
        metadata['parents'] = [folder_id]

    resp = http_requests.post(
        f'{UPLOAD_API}/files?uploadType=multipart&fields=id,name,webViewLink',
        headers=_auth(conn),
        files={
            'metadata': (None, json.dumps(metadata), 'application/json'),
            'file': (filename, io.BytesIO(content_bytes), mime_type),
        },
        timeout=60,
    )
    return resp.json()


# ─── Auto-sync hooks ─────────────────────────────────────────────────────────

def _get_workspace_folder(conn, workspace):
    """Return DriveWorkspaceFolder for conn+workspace, creating if needed."""
    from .models import DriveWorkspaceFolder
    wf, _ = DriveWorkspaceFolder.objects.get_or_create(connection=conn, workspace=workspace)
    return wf


def _mark_synced(creative_ids):
    """Add 'Google Drive Synced' tag to the given GeneratedCreative ids."""
    if not creative_ids:
        return
    try:
        from apps.creatives.models import GeneratedCreative, CreativeTag
        creatives = list(GeneratedCreative.objects.filter(id__in=creative_ids).select_related('workspace'))
        if not creatives:
            return
        workspace = creatives[0].workspace
        tag, _ = CreativeTag.objects.get_or_create(
            workspace=workspace, name='Google Drive Synced',
            defaults={'color': '#34a853'},
        )
        for c in creatives:
            c.tags.add(tag)
    except Exception:
        pass


def auto_sync_generation(workspace, job, image_urls, creative_ids=None):
    """Upload generated images to Troxa.ai/{workspace}/Images in the job creator's Drive."""
    from django.db import close_old_connections
    close_old_connections()

    try:
        conn = job.created_by.drive_connection
    except Exception:
        return

    if not conn.auto_sync:
        return

    wf = _get_workspace_folder(conn, workspace)
    if not wf.sync_creatives:
        return

    try:
        images_folder_id, _, _ = get_or_create_workspace_folders(conn, workspace)
        campaign = job.campaign.name if job.campaign else 'Generation'

        uploaded = 0
        for i, url in enumerate(image_urls, 1):
            r = http_requests.get(url, timeout=30)
            if not r.ok:
                logger.warning('Drive sync: failed to fetch image %s (status %s)', url, r.status_code)
                continue
            ext = 'png' if 'png' in r.headers.get('content-type', '') else 'jpg'
            filename = f'{campaign} — Variant {i}.{ext}'
            upload_to_drive(conn, filename, r.content, r.headers.get('content-type', 'image/png'), images_folder_id)
            uploaded += 1

        if uploaded and creative_ids:
            _mark_synced(creative_ids)
        logger.info('Drive sync: uploaded %d images for job %s', uploaded, job.pk)
    except Exception as e:
        logger.exception('Drive sync failed for job %s: %s', job.pk, e)


def auto_sync_video(workspace, vjob, creative_id=None):
    """Upload a generated video to Troxa.ai/{workspace}/Videos in the job creator's Drive."""
    from django.db import close_old_connections
    close_old_connections()

    try:
        conn = vjob.created_by.drive_connection
    except Exception:
        return

    if not conn.auto_sync or not vjob.video_url:
        return

    wf = _get_workspace_folder(conn, workspace)
    if not wf.sync_videos:
        return

    try:
        _, videos_folder_id, _ = get_or_create_workspace_folders(conn, workspace)
        name = (vjob.source_creative.name if vjob.source_creative else f'Video {vjob.pk}') + '.mp4'
        r = http_requests.get(vjob.video_url, timeout=60)
        if r.ok:
            upload_to_drive(conn, name, r.content, 'video/mp4', videos_folder_id)
            if creative_id:
                _mark_synced([creative_id])
        else:
            logger.warning('Drive video sync: failed to fetch video %s', vjob.video_url)
    except Exception as e:
        logger.exception('Drive video sync failed for vjob %s: %s', vjob.pk, e)


def auto_sync_logo_creative(user, workspace, creative_name, image_bytes, creative_id=None):
    """Upload a logo-applied creative to Troxa.ai/{workspace}/With Logo."""
    from django.db import close_old_connections
    close_old_connections()

    try:
        conn = user.drive_connection
    except Exception:
        return

    if not conn.auto_sync:
        return

    wf = _get_workspace_folder(conn, workspace)
    if not wf.sync_logos:
        return

    try:
        _, _, logos_folder_id = get_or_create_workspace_folders(conn, workspace)
        filename = f'{creative_name}.png'
        upload_to_drive(conn, filename, image_bytes, 'image/png', logos_folder_id)
        if creative_id:
            _mark_synced([creative_id])
        logger.info('Drive logo sync: uploaded "%s"', filename)
    except Exception as e:
        logger.exception('Drive logo sync failed for "%s": %s', creative_name, e)


def manual_sync_creative(user, workspace, creative):
    """
    Manually upload a single creative to the appropriate Drive folder.
    Sets google_drive_synced=True on success.
    Returns dict with 'ok' bool and optional 'error'.
    """
    try:
        conn = user.drive_connection
    except Exception:
        return {'ok': False, 'error': 'Drive not connected'}

    if not conn.auto_sync:
        return {'ok': False, 'error': 'Auto-sync is disabled'}

    try:
        images_folder_id, videos_folder_id, logos_folder_id = get_or_create_workspace_folders(conn, workspace)

        # Determine folder and content based on media_type
        media = (creative.media_type or '').lower()
        if media == 'video':
            url = creative.video_jobs.order_by('-created_at').first()
            if url:
                url = url.video_url
            else:
                url = creative.image_url
            folder_id = videos_folder_id
            mime = 'video/mp4'
            filename = f'{creative.name}.mp4'
        elif creative.logo_applied_url:
            url = creative.logo_applied_url
            folder_id = logos_folder_id
            mime = 'image/png'
            filename = f'{creative.name}_logo.png'
        else:
            url = creative.image_url
            folder_id = images_folder_id
            mime = 'image/png'
            filename = f'{creative.name}.png'

        if not url:
            return {'ok': False, 'error': 'No file URL found'}

        r = http_requests.get(url, timeout=60)
        if not r.ok:
            return {'ok': False, 'error': f'Failed to fetch file (HTTP {r.status_code})'}

        result = upload_to_drive(conn, filename, r.content, mime, folder_id)
        _mark_synced([creative.id])
        return {'ok': True, 'drive_file_id': result.get('id'), 'drive_url': result.get('webViewLink')}
    except Exception as e:
        logger.exception('manual_sync_creative failed for %s: %s', creative.pk, e)
        return {'ok': False, 'error': str(e)}
