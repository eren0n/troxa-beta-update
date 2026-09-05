"""
Data Lab API views.

Endpoints:
  GET  /api/data-lab/ads/            — list all ad records (queue)
  POST /api/data-lab/ads/sync/       — trigger Meta API sync
  GET  /api/data-lab/ads/<id>/       — ad detail with full metrics
  PATCH /api/data-lab/ads/<id>/      — save employee annotations
  GET  /api/data-lab/ads/<id>/image/ — proxy full-size creative image
  GET  /api/data-lab/export/         — download labeled records as JSONL
"""
import json
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from .models import AdRecord
from .serializers import AdRecordSerializer, AdRecordListSerializer
from .export import build_jsonl


class IsDataUser(IsAuthenticated):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and (
            getattr(request.user, 'is_data_user', False)
            or request.user.email in {'eren@rmgs.online', 'kaan@rmgs.online', 'tolga@rmgs.online'}
        )


class AdListView(APIView):
    permission_classes = [IsDataUser]

    def get(self, request):
        qs = AdRecord.objects.all()
        status_filter = request.query_params.get('status')
        if status_filter == 'labeled':
            qs = [r for r in qs if r.is_labeled]
        elif status_filter == 'pending':
            qs = [r for r in qs if not r.is_labeled]
        else:
            qs = list(qs)
        serializer = AdRecordListSerializer(qs, many=True, context={'request': request})
        total = AdRecord.objects.count()
        labeled = sum(1 for r in AdRecord.objects.all() if r.is_labeled)
        return Response({
            'total': total,
            'labeled': labeled,
            'pending': total - labeled,
            'ads': serializer.data,
        })


class AdSyncView(APIView):
    permission_classes = [IsDataUser]

    def post(self, request):
        from .meta_client import sync_account

        account_id = request.data.get('account_id') or None
        date_preset = request.data.get('date_preset', 'maximum')

        try:
            records = sync_account(account_id=account_id, date_preset=date_preset, download_images=False)
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        except RuntimeError as e:
            return Response({'error': str(e)}, status=502)

        created_count = 0
        updated_count = 0
        for rec in records:
            obj, created = AdRecord.objects.get_or_create(
                ad_id=rec['ad_id'],
                defaults=rec,
            )
            if not created:
                # Update metrics and meta fields; preserve existing annotations
                updatable = {k: v for k, v in rec.items() if k not in (
                    'target_audience', 'notes', 'personal_rating', 'success_rating',
                    'labeled_by', 'labeled_at',
                )}
                for k, v in updatable.items():
                    setattr(obj, k, v)
                obj.save()
                updated_count += 1
            else:
                created_count += 1

        return Response({
            'synced': len(records),
            'created': created_count,
            'updated': updated_count,
        })


class AdDetailView(APIView):
    permission_classes = [IsDataUser]

    def get(self, request, pk):
        try:
            ad = AdRecord.objects.get(pk=pk)
        except AdRecord.DoesNotExist:
            return Response(status=404)
        return Response(AdRecordSerializer(ad, context={'request': request}).data)

    def patch(self, request, pk):
        try:
            ad = AdRecord.objects.get(pk=pk)
        except AdRecord.DoesNotExist:
            return Response(status=404)

        allowed = ('target_audience', 'notes', 'personal_rating', 'success_rating')
        for field in allowed:
            if field in request.data:
                setattr(ad, field, request.data[field])

        # Validate ratings
        for rating_field in ('personal_rating', 'success_rating'):
            val = getattr(ad, rating_field)
            if val is not None and (not isinstance(val, int) or not (1 <= val <= 10)):
                return Response({rating_field: 'Must be an integer between 1 and 10'}, status=400)

        if not ad.target_audience and request.data.get('target_audience') == '':
            return Response({'target_audience': 'This field is required before saving.'}, status=400)

        ad.labeled_by = request.user
        ad.labeled_at = datetime.now(tz=timezone.utc)
        ad.save()
        return Response(AdRecordSerializer(ad, context={'request': request}).data)


class ExportView(APIView):
    """GET /api/data-lab/export/
    Query params:
      format   = qwen (default) | llama_factory | raw_json
      min_success_rating = integer (1-10)
      min_personal_rating = integer (1-10)
    Returns a JSONL file download.
    """
    permission_classes = [IsDataUser]

    def get(self, request):
        try:
            qs = [r for r in AdRecord.objects.all() if r.is_labeled]

            min_success = request.query_params.get('min_success_rating')
            min_personal = request.query_params.get('min_personal_rating')
            if min_success:
                try:
                    qs = [r for r in qs if r.success_rating >= int(min_success)]
                except ValueError:
                    pass
            if min_personal:
                try:
                    qs = [r for r in qs if r.personal_rating >= int(min_personal)]
                except ValueError:
                    pass

            export_format = request.query_params.get('export_format', 'qwen')
            lines = build_jsonl(qs, fmt=export_format)

            response = HttpResponse('\n'.join(lines), content_type='application/jsonl')
            response['Content-Disposition'] = f'attachment; filename="dataset_{datetime.now().strftime("%Y%m%d_%H%M%S")}.jsonl"'
            return response
        except Exception as exc:
            import traceback
            logger.error('ExportView exception: %s\n%s', exc, traceback.format_exc())
            return Response({'error': str(exc), 'type': type(exc).__name__}, status=500)


class AdMediaInfoView(APIView):
    """Returns media type + direct CDN URLs for a single ad creative.
    GET /api/data-lab/ads/<pk>/media/
    Response: {media_type: 'video'|'image'|'none', video_url?, poster_url?}
    """
    permission_classes = [IsDataUser]

    def get(self, request, pk):
        try:
            ad = AdRecord.objects.get(pk=pk)
        except AdRecord.DoesNotExist:
            return Response(status=404)
        from .meta_client import fetch_media_info
        return Response(fetch_media_info(ad.ad_id))


class ExportZipView(APIView):
    """GET /api/data-lab/export/zip/
    Downloads a zip containing dataset.jsonl + all creative images.
    Same filter params as ExportView.
    """
    permission_classes = [IsDataUser]

    def get(self, request):
        import zipfile
        import io
        import mimetypes
        import requests as http

        try:
            qs = [r for r in AdRecord.objects.all() if r.is_labeled]
            min_success = request.query_params.get('min_success_rating')
            min_personal = request.query_params.get('min_personal_rating')
            if min_success:
                try:
                    qs = [r for r in qs if r.success_rating >= int(min_success)]
                except ValueError:
                    pass
            if min_personal:
                try:
                    qs = [r for r in qs if r.personal_rating >= int(min_personal)]
                except ValueError:
                    pass

            export_format = request.query_params.get('export_format', 'qwen')
            buf = io.BytesIO()
            image_path_map = {}

            from .meta_client import fetch_creative_image

            with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
                for rec in qs:
                    try:
                        img_bytes, content_type = fetch_creative_image(rec.ad_id)
                        if not img_bytes:
                            continue
                        ext = mimetypes.guess_extension(content_type.split(';')[0]) or '.jpg'
                        if ext in ('.jpe', '.jpeg'):
                            ext = '.jpg'
                        filename = f'{rec.ad_id}{ext}'
                        zf.writestr(filename, img_bytes)
                        image_path_map[rec.id] = filename
                    except Exception:
                        continue  # skip records where image fetch fails entirely

                # Only include records that have a successfully fetched image
                records_with_images = [r for r in qs if r.id in image_path_map]
                lines = build_jsonl(records_with_images, fmt=export_format, image_path_map=image_path_map)
                zf.writestr('visual_dataset.jsonl', '\n'.join(lines))

            buf.seek(0)
            ts = datetime.now().strftime('%Y%m%d_%H%M%S')
            response = HttpResponse(buf.read(), content_type='application/zip')
            response['Content-Disposition'] = f'attachment; filename="dataset_{ts}.zip"'
            return response

        except Exception as exc:
            import traceback
            logger.error('ExportZipView exception: %s\n%s', exc, traceback.format_exc())
            return Response({'error': str(exc)}, status=500)


class AdImageProxyView(APIView):
    """Proxy the creative image for an ad — fetches full-size from Meta on demand."""
    permission_classes = [IsDataUser]

    def get(self, request, pk):
        try:
            ad = AdRecord.objects.get(pk=pk)
        except AdRecord.DoesNotExist:
            return Response(status=404)

        from .meta_client import fetch_creative_image
        image_bytes, content_type = fetch_creative_image(ad.ad_id)
        if not image_bytes:
            return Response({'error': 'Could not fetch image'}, status=502)

        return HttpResponse(image_bytes, content_type=content_type)
