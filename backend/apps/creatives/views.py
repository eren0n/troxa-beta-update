import io
import os
import fal_client
import requests as http_requests
from urllib.parse import urlparse
from PIL import Image as PILImage
from django.conf import settings
from django.db.models import Q, F
from django.http import StreamingHttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from apps.accounts.views import get_workspace, require_editor
from apps.accounts.models import User

# ---------------------------------------------------------------------------
# SSRF protection — allowlist of trusted image hosts for user-supplied URLs
# ---------------------------------------------------------------------------
_TRUSTED_IMAGE_HOSTS = {
    # fal.ai storage CDN (generated creative images)
    'v3.fal.media',
    'fal.media',
    # Google Cloud Storage (fal backend)
    'storage.googleapis.com',
    # Our own domains
    'troxa.ai',
    'test.troxa.ai',
    # Local dev only
    'localhost',
    '127.0.0.1',
}


def _validate_source_image_url(url):
    """
    Return (True, None) if url is safe to persist as a video source.
    Return (False, error_message) otherwise.

    Rules:
    - Must be http or https scheme only (blocks file://, ftp://, etc.)
    - http:// only allowed for localhost/127.0.0.1 (local dev)
    - Hostname must be in the trusted allowlist
    """
    if not url:
        return True, None
    try:
        parsed = urlparse(url)
    except Exception:
        return False, 'Invalid URL format.'
    if parsed.scheme not in ('http', 'https'):
        return False, 'Only http and https URLs are permitted as image source.'
    if parsed.scheme == 'http' and parsed.hostname not in ('localhost', '127.0.0.1'):
        return False, 'Plain http:// URLs are not permitted for external hosts.'
    if parsed.hostname not in _TRUSTED_IMAGE_HOSTS:
        return False, (
            f'Image source host "{parsed.hostname}" is not permitted. '
            'Use a URL from your generated creatives.'
        )
    return True, None


class QueryParamJWTAuthentication(JWTAuthentication):
    """Allow JWT via ?token= query param so <img> tags can authenticate."""
    def authenticate(self, request):
        token = request.query_params.get('token')
        if not token:
            return super().authenticate(request)
        try:
            validated = self.get_validated_token(token)
            return self.get_user(validated), validated
        except (InvalidToken, TokenError):
            return None
from apps.activity.utils import log_event
from apps.brand_kit.models import Logo, Disclaimer, Campaign, Character
from apps.billing.models import Subscription

from .models import GenerationJob, GeneratedCreative, VideoJob, LogoJob, LogoJobImage, CreativeTag
from .serializers import (
    GenerationJobSerializer, GeneratedCreativeSerializer,
    VideoJobSerializer, VideoJobDetailSerializer,
    LogoJobImageSerializer, CreativeTagSerializer,
)
from .services import (
    generate_job_async, make_video_async,
    composite_logos_manual, calculate_logo_placements,
    _deduct_credits, _build_creative_name, _fetch_bytes,
    aspect_ratio_label_from_size,
)


MODEL_CREDIT_COST = {
    'Nano Banana Pro':  2,
    'GPT Image 2':      2,
    'Seedream 5.0 Pro': 2,
}


def _check_credits(ws, num_images, model_name='Nano Banana 2'):
    """Return (ok, Response_or_None). Blocks if monthly available credits < required."""
    cost_per_img = MODEL_CREDIT_COST.get(model_name, 1)
    num_images = num_images * cost_per_img
    try:
        sub = ws.subscription
    except Subscription.DoesNotExist:
        return False, Response(
            {'error': 'insufficient_credits', 'detail': 'No credit account found. Please contact support.'},
            status=402
        )
    # Enterprise / unlimited_usage plans bypass the credit check entirely
    if sub.plan.unlimited_usage:
        return True, None
    available = sub.credits_available
    if available < num_images:
        return False, Response(
            {
                'error': 'insufficient_credits',
                'detail': f'You need {num_images} credit(s) but only have {available} left this month. Upgrade your plan or add bonus credits.',
                'available': available,
                'required': num_images,
                'upgrade_required': True,
            },
            status=402
        )
    return True, None


class GenerateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ws = get_workspace(request)
        if not ws:
            return Response(status=404)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Your role does not have permission to generate creatives.'}, status=403)

        num_images = int(request.data.get('num_images', 2))
        model_name = request.data.get('model_name', 'Nano Banana 2')
        ok, err = _check_credits(ws, num_images, model_name)
        if not ok:
            return err

        d = request.data

        # Resolve FKs
        campaign = None
        if d.get('campaign_id'):
            campaign = ws.campaigns.filter(id=d['campaign_id']).first()

        disclaimer = None
        if d.get('disclaimer_id'):
            disclaimer = ws.disclaimers.filter(id=d['disclaimer_id']).first()

        logo = None
        if d.get('logo_id'):
            logo = ws.logos.filter(id=d['logo_id']).first()

        character = None
        if d.get('character_id'):
            character = ws.characters.filter(id=d['character_id']).first()

        job = GenerationJob.objects.create(
            workspace=ws,
            created_by=request.user,
            campaign=campaign,
            disclaimer=disclaimer,
            model_name=d.get('model_name', 'Nano Banana 2'),
            aspect_ratio=d.get('aspect_ratio', '1:1'),
            resolution=d.get('resolution', '1K'),
            num_images=num_images,
            output_format=d.get('output_format', 'png'),
            generate_new_character=bool(d.get('generate_new_character', False)),
            image_size=d.get('image_size') or '',
            image_quality=d.get('image_quality') or 'high',
            style=d.get('style') or '',
            extra_prompt=d.get('extra_prompt') or '',
            negative_prompt=d.get('negative_prompt') or '',
            use_fingerprint=bool(d.get('use_fingerprint', False)),
            blend_weight=int(d.get('blend_weight', 50)),
            simplicity_weight=int(d['simplicity_weight']) if d.get('simplicity_mode') and d.get('simplicity_weight') is not None else None,
            generation_mode=d.get('generation_mode', 'auto'),
            logo=logo,
            character=character,
        )

        static_ids = d.get('static_ids', [])
        if static_ids:
            references = ws.creatives.filter(id__in=static_ids, media_type='Photo')
            job.reference_creatives.set(references)

        # If the caller supplies a pre-built master prompt (from Prompt Architect),
        # store it now so the generation worker skips the DNA build step entirely.
        prebuilt = d.get('prebuilt_master_prompt') or ''
        if prebuilt.strip():
            job.master_prompt = prebuilt.strip()
            job.save(update_fields=['master_prompt'])

        log_event(ws, request.user, 'generation_started', f'Generation job #{job.id} queued')
        generate_job_async(job.id)

        return Response(GenerationJobSerializer(job).data, status=202)


class JobsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        jobs = ws.generation_jobs.prefetch_related('creatives').all()[:20]
        return Response(GenerationJobSerializer(jobs, many=True).data)


class JobDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        ws = get_workspace(request)
        try:
            job = ws.generation_jobs.prefetch_related('creatives').get(pk=pk)
        except GenerationJob.DoesNotExist:
            return Response(status=404)
        return Response(GenerationJobSerializer(job).data)


GALLERY_ORDERINGS = {
    '-created_at': ('-created_at',),
    'created_at': ('created_at',),
    '-rating': (F('rating').desc(nulls_last=True), '-created_at'),
    'rating': (F('rating').asc(nulls_last=True), '-created_at'),
}
GALLERY_DEFAULT_PAGE_SIZE = 12
GALLERY_MAX_PAGE_SIZE = 60


class GalleryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        p = request.query_params
        qs = ws.creatives.filter(in_gallery=True).select_related(
            'job__created_by', 'campaign', 'uploaded_by'
        ).prefetch_related('job__statics', 'tags')

        # Primary filters
        if p.get('source'):
            qs = qs.filter(source=p['source'])
        if p.get('media_type'):
            qs = qs.filter(media_type__iexact=p['media_type'])
        if p.get('is_edited') is not None and p['is_edited'] != '':
            qs = qs.filter(is_edited=p['is_edited'].lower() == 'true')

        # Additional filters
        if p.get('campaign_id'):
            qs = qs.filter(campaign_id=p['campaign_id'])
        if p.get('aspect_ratio'):
            qs = qs.filter(aspect_ratio=p['aspect_ratio'])
        # Comma-separated user ids — OR semantics: a creative only has one
        # author, so matching any of the selected people is the only
        # sensible interpretation (and is exactly what __in gives us).
        if p.get('generated_by'):
            ids = [v.strip() for v in p['generated_by'].split(',') if v.strip()]
            if ids:
                qs = qs.filter(created_by_id__in=ids)
        if p.get('rating_min'):
            qs = qs.filter(rating__gte=int(p['rating_min']))
        if p.get('rating_max'):
            qs = qs.filter(rating__lte=int(p['rating_max']))
        if p.get('date_from'):
            qs = qs.filter(created_at__date__gte=p['date_from'])
        if p.get('date_to'):
            qs = qs.filter(created_at__date__lte=p['date_to'])

        # Free-text search across creative name and campaign name
        search = (p.get('search') or '').strip()
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(campaign__name__icontains=search))


        # Custom tag filter (comma-separated tag names) — AND semantics: a
        # creative must carry every selected tag, not just any one of them.
        # Chaining a separate .filter() call per tag (rather than one
        # tags__name__in=[...] call) adds one join per tag, so a matching row
        # has to satisfy all of them at once. Tags are already workspace-scoped
        # by construction (CreativeTag.unique_together + assignment always
        # goes through ws.creative_tags), but `tags__workspace=ws` is added
        # here too as a defensive, self-evident guarantee at the query itself.
        if p.get('tags'):
            tag_names = [t.strip() for t in p['tags'].split(',') if t.strip()]
            for tag_name in tag_names:
                qs = qs.filter(tags__workspace=ws, tags__name=tag_name)
            if tag_names:
                qs = qs.distinct()

        qs = qs.order_by(*GALLERY_ORDERINGS.get(p.get('ordering'), GALLERY_ORDERINGS['-created_at']))

        count = qs.count()

        try:
            page = max(1, int(p.get('page', 1)))
        except (TypeError, ValueError):
            page = 1
        try:
            page_size = int(p.get('page_size', GALLERY_DEFAULT_PAGE_SIZE))
        except (TypeError, ValueError):
            page_size = GALLERY_DEFAULT_PAGE_SIZE
        page_size = max(1, min(page_size, GALLERY_MAX_PAGE_SIZE))

        start = (page - 1) * page_size
        page_items = qs[start:start + page_size]

        return Response({
            'results': GeneratedCreativeSerializer(page_items, many=True, context={'request': request}).data,
            'count': count,
            'page': page,
            'page_size': page_size,
            'has_more': start + page_size < count,
        })


class UploadCreativeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import mimetypes
        ws = get_workspace(request)
        if not ws:
            return Response(status=404)

        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'file required'}, status=400)

        mime = file.content_type or mimetypes.guess_type(file.name)[0] or ''
        if mime.startswith('video/'):
            media_type = 'Video'
        else:
            media_type = 'Photo'

        # Real pixel dimensions, not a client-supplied guess — every upload
        # used to default to '1:1' regardless of the actual image shape.
        aspect_ratio = request.data.get('aspect_ratio') or '1:1'
        if media_type == 'Photo':
            try:
                from PIL import Image as PILImage, ImageOps
                file.seek(0)
                with PILImage.open(file) as im:
                    im = ImageOps.exif_transpose(im)
                    aspect_ratio = aspect_ratio_label_from_size(*im.size)
                file.seek(0)
            except Exception:
                pass

        campaign = None
        if request.data.get('campaign_id'):
            campaign = ws.campaigns.filter(id=request.data['campaign_id']).first()

        creative = GeneratedCreative(
            workspace=ws,
            campaign=campaign,
            name=request.data.get('name') or file.name,
            media_type=media_type,
            aspect_ratio=aspect_ratio,
            source='uploaded',
            uploaded_by=request.user,
            created_by=request.user,
            in_gallery=True,
        )
        creative.uploaded_file.save(file.name, file, save=False)
        creative.image_url = request.build_absolute_uri(creative.uploaded_file.url)

        # Generate a lightweight thumbnail (max 600px wide) so the gallery card
        # doesn't have to load the full-resolution upload just to display a grid cell.
        if media_type == 'Photo':
            try:
                from PIL import Image as _PIL, ImageOps as _IOPS
                from io import BytesIO
                from django.core.files.base import ContentFile
                from django.conf import settings as _s
                import pathlib, uuid as _uuid

                src_path = creative.uploaded_file.path
                with _PIL.open(src_path) as _im:
                    _im = _IOPS.exif_transpose(_im)
                    _im.thumbnail((600, 600), _PIL.LANCZOS)
                    if _im.mode in ('RGBA', 'LA', 'P'):
                        _im = _im.convert('RGB')
                    _buf = BytesIO()
                    _im.save(_buf, format='JPEG', quality=82, optimize=True)
                    _buf.seek(0)

                thumb_dir = pathlib.Path(_s.MEDIA_ROOT) / 'creative_thumbs'
                thumb_dir.mkdir(parents=True, exist_ok=True)
                thumb_name = f'{creative.pk}.jpg'
                (thumb_dir / thumb_name).write_bytes(_buf.getvalue())
                creative.thumbnail_url = request.build_absolute_uri(
                    _s.MEDIA_URL + f'creative_thumbs/{thumb_name}'
                )
            except Exception:
                pass

        creative.save()

        # Fingerprint: uploaded creatives are treated as gallery references (strong positive, no rating)
        try:
            from apps.fingerprint.services import trigger_analyze_generation
            trigger_analyze_generation(creative.id, ws.id)
        except Exception:
            pass

        log_event(ws, request.user, 'creative_uploaded', f'Uploaded creative: {creative.name}')
        return Response(GeneratedCreativeSerializer(creative, context={'request': request}).data, status=201)


class ContributorsView(APIView):
    """GET /api/creatives/contributors/ — everyone who has ever
    generated/uploaded/edited a creative in this workspace, for the
    "Generated By" filter's autocomplete. Driven by actual creative
    authorship, not the live team roster, so members who've since left
    still show up (their User row isn't deleted, just their membership).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        user_ids = ws.creatives.filter(created_by__isnull=False).values_list('created_by_id', flat=True).distinct()
        users = User.objects.filter(id__in=user_ids)
        data = [
            {'id': str(u.id), 'name': u.get_full_name().strip() or u.email}
            for u in users
        ]
        data.sort(key=lambda d: d['name'].lower())
        return Response(data)


class CreativeTagView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        tags = ws.creative_tags.all()
        return Response(CreativeTagSerializer(tags, many=True).data)

    def post(self, request):
        ws = get_workspace(request)
        name = request.data.get('name', '').strip()
        if not name:
            return Response({'error': 'name required'}, status=400)
        tag, _ = CreativeTag.objects.get_or_create(
            workspace=ws, name=name,
            defaults={'color': request.data.get('color', '#6366f1'), 'created_by': request.user},
        )
        return Response(CreativeTagSerializer(tag).data, status=201)


class CreativeTagAssignView(APIView):
    """PATCH /api/creatives/<pk>/tags/ — set tags for a creative (replaces existing)."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        ws = get_workspace(request)
        creative = ws.creatives.filter(pk=pk).first()
        if not creative:
            return Response(status=404)
        tag_ids = request.data.get('tag_ids', [])
        tags = ws.creative_tags.filter(id__in=tag_ids)
        creative.tags.set(tags)
        return Response(CreativeTagSerializer(creative.tags.all(), many=True).data)


class CreativeDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, ws, pk):
        return ws.creatives.filter(pk=pk).first()

    def get(self, request, pk):
        ws = get_workspace(request)
        creative = self._get(ws, pk)
        if not creative:
            return Response(status=404)
        return Response(GeneratedCreativeSerializer(creative).data)

    def patch(self, request, pk):
        ws = get_workspace(request)
        creative = self._get(ws, pk)
        if not creative:
            return Response(status=404)
        for field in ('logo_position', 'media_type', 'name', 'status', 'feedback_text',
                      'is_edited', 'aspect_ratio', 'campaign_id'):
            if field in request.data:
                setattr(creative, field, request.data[field])
        rating_changed = False
        if 'rating' in request.data:
            val = request.data['rating']
            new_rating = max(1, min(10, int(val))) if val is not None else None
            if new_rating != creative.rating:
                creative.rating = new_rating
                rating_changed = True
        creative.save()
        # Fingerprint: trigger Agent 1 analysis whenever rating is set/changed
        if rating_changed and creative.rating is not None:
            try:
                from apps.fingerprint.services import trigger_analyze_generation
                trigger_analyze_generation(creative.id, ws.id)
            except Exception:
                pass
        return Response(GeneratedCreativeSerializer(creative).data)

    def delete(self, request, pk):
        ws = get_workspace(request)
        creative = self._get(ws, pk)
        if not creative:
            return Response(status=404)
        creative.delete()
        return Response(status=204)


class CreativeLogoView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        ws = get_workspace(request)
        creative = ws.creatives.filter(pk=pk).first()
        if not creative:
            return Response(status=404)
        creative.logo_position = request.data.get('logo_position', creative.logo_position)
        creative.save(update_fields=['logo_position'])
        return Response(GeneratedCreativeSerializer(creative).data)


class MakeVideoView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Your role does not have permission to create videos.'}, status=403)
        creative = ws.creatives.filter(pk=pk).first()
        if not creative:
            return Response(status=404)
        prompt = request.data.get('prompt', 'Smooth cinematic motion')
        # Use user-supplied URL only after SSRF validation; fall back to the
        # creative's stored URL (trusted — written by our own generation pipeline).
        user_supplied_url = request.data.get('source_image_url', '').strip()
        if user_supplied_url:
            ok, err = _validate_source_image_url(user_supplied_url)
            if not ok:
                return Response({'detail': err}, status=400)
            source_image_url = user_supplied_url
        else:
            source_image_url = creative.image_url
        duration = max(5, min(15, int(request.data.get('duration', 5))))
        vjob = VideoJob.objects.create(
            workspace=ws,
            created_by=request.user,
            source_creative=creative,
            source_image_url=source_image_url,
            prompt=prompt,
            duration=duration,
        )
        log_event(ws, request.user, 'make_video', f'Video job #{vjob.id} queued')
        make_video_async(vjob.id)
        return Response(VideoJobSerializer(vjob).data, status=202)


class VideoJobsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        jobs = ws.video_jobs.all()[:50]
        return Response(VideoJobDetailSerializer(jobs, many=True).data)


class VideoJobDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        ws = get_workspace(request)
        try:
            vjob = ws.video_jobs.get(pk=pk)
        except VideoJob.DoesNotExist:
            return Response(status=404)
        return Response(VideoJobDetailSerializer(vjob).data)


class LogoPlacementsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, job_pk):
        ws = get_workspace(request)
        try:
            job = ws.generation_jobs.get(pk=job_pk)
        except GenerationJob.DoesNotExist:
            return Response(status=404)

        logo_id = request.query_params.get('logo_id')
        logo = ws.logos.filter(id=logo_id).first() if logo_id else ws.logos.filter(is_primary=True).first() or ws.logos.first()
        if not logo:
            return Response({'detail': 'No logo found.'}, status=400)

        from apps.brand_kit.serializers import LogoSerializer
        placements = calculate_logo_placements(job, logo)
        return Response({
            'logo': LogoSerializer(logo, context={'request': request}).data,
            'placements': placements,
        })


class LogoEditorSaveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, job_pk):
        ws = get_workspace(request)
        try:
            job = ws.generation_jobs.get(pk=job_pk)
        except GenerationJob.DoesNotExist:
            return Response(status=404)

        from django.core.files.base import ContentFile

        logo_job = LogoJob.objects.create(workspace=ws, created_by=request.user, source_job=job)
        saved_images = []

        for item in request.data.get('placements', []):
            creative_id = item.get('creative_id')
            creative = ws.creatives.filter(pk=creative_id).first()
            if not creative:
                continue

            logos_for_composite = []
            for logo_data in item.get('logos', []):
                logo = ws.logos.filter(id=logo_data.get('logo_id')).first()
                if not logo:
                    continue
                logos_for_composite.append({
                    'logo_path': logo.file.path,
                    'x': int(logo_data.get('x', 0)),
                    'y': int(logo_data.get('y', 0)),
                    'logo_w': int(logo_data.get('logo_w', 100)),
                    'logo_h': int(logo_data.get('logo_h', 50)),
                    'angle_deg': float(logo_data.get('angle_deg', 0)),
                    'opacity': float(logo_data.get('opacity', 1.0)),
                })

            if not logos_for_composite:
                continue

            try:
                result = composite_logos_manual(creative.image_url, logos_for_composite)
                buf = io.BytesIO()
                result.save(buf, format='PNG')
                image_bytes = buf.getvalue()
                lji = LogoJobImage(job=logo_job, source_creative=creative)
                lji.file.save(
                    f'logo_{logo_job.pk}_{creative_id}.png',
                    ContentFile(image_bytes),
                    save=True,
                )
                saved_images.append(lji)
                creative.logo_applied_url = request.build_absolute_uri(lji.file.url)
                creative.save(update_fields=['logo_applied_url'])

                # Drive sync — fire and forget
                try:
                    from apps.drive_integration.services import auto_sync_logo_creative
                    import threading as _t
                    _t.Thread(
                        target=auto_sync_logo_creative,
                        args=(request.user, ws, creative.name, image_bytes),
                        daemon=True,
                    ).start()
                except Exception:
                    pass
            except Exception:
                continue

        logo_job.status = 'done' if saved_images else 'error'
        logo_job.save(update_fields=['status'])

        # Slack notify — fire and forget
        if saved_images:
            try:
                from apps.slack_integration.services import notify_slack_logo_save
                import threading as _t
                image_urls = [request.build_absolute_uri(lji.file.url) for lji in saved_images]
                logo_creative_ids = [str(lji.source_creative_id) for lji in saved_images if lji.source_creative_id]
                _t.Thread(
                    target=notify_slack_logo_save,
                    args=(ws, image_urls),
                    kwargs={'user': request.user, 'creative_ids': logo_creative_ids},
                    daemon=True,
                ).start()
            except Exception:
                pass

        return Response({
            'logo_job_id': logo_job.id,
            'images': LogoJobImageSerializer(saved_images, many=True, context={'request': request}).data,
        })


class LogoResultsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        images = LogoJobImage.objects.filter(job__workspace=ws).order_by('-created_at')
        return Response(LogoJobImageSerializer(images, many=True, context={'request': request}).data)


class VideoJobProxyView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, pk):
        vjob = VideoJob.objects.filter(pk=pk).first()
        if not vjob or not vjob.video_url:
            return Response(status=404)
        try:
            upstream = http_requests.get(vjob.video_url, stream=True, timeout=60)
            upstream.raise_for_status()
            content_type = upstream.headers.get('Content-Type', 'video/mp4').split(';')[0]
            response = StreamingHttpResponse(
                upstream.iter_content(chunk_size=65536),
                content_type=content_type,
            )
            response['Cache-Control'] = 'public, max-age=86400'
            response['Content-Disposition'] = f'inline; filename="{pk}.mp4"'
            return response
        except Exception:
            from django.http import HttpResponseRedirect
            return HttpResponseRedirect(vjob.video_url)


class CreativeImageProxyView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, pk):
        from apps.creatives.models import GeneratedCreative
        from django.http import FileResponse, HttpResponseRedirect
        creative = GeneratedCreative.objects.filter(pk=pk).first()
        if not creative:
            return Response(status=404)

        use_logo = request.query_params.get('type') == 'logo'

        # For uploaded creatives: serve the file directly from disk (no self-HTTP round-trip)
        if not use_logo and creative.uploaded_file and creative.uploaded_file.name:
            try:
                import mimetypes as _mimetypes
                file_path = creative.uploaded_file.path
                if os.path.exists(file_path):
                    mime = _mimetypes.guess_type(file_path)[0] or 'image/jpeg'
                    f = open(file_path, 'rb')
                    resp = FileResponse(f, content_type=mime)
                    resp['Cache-Control'] = 'public, max-age=86400'
                    resp['Content-Disposition'] = f'inline; filename="{pk}"'
                    return resp
            except Exception:
                pass

        url = creative.logo_applied_url if use_logo and creative.logo_applied_url else creative.image_url
        if not url:
            return Response(status=404)

        try:
            upstream = http_requests.get(url, stream=True, timeout=30)
            upstream.raise_for_status()
            content_type = upstream.headers.get('Content-Type', 'image/jpeg').split(';')[0]
            ext = 'mp4' if 'video' in content_type else 'jpg'
            response = StreamingHttpResponse(
                upstream.iter_content(chunk_size=32768),
                content_type=content_type,
            )
            response['Cache-Control'] = 'public, max-age=86400'
            response['Content-Disposition'] = f'inline; filename="{pk}.{ext}"'
            return response
        except Exception:
            return HttpResponseRedirect(url)


_AI_RATIO_MAP = {
    'Current Size': 'auto',
    '1:1 — Square': '1:1',
    '4:5 — Portrait': '4:5',
    '9:16 — Story': '9:16',
    '16:9 — Landscape': '16:9',
    '3:2': '3:2', '2:3': '2:3', '16:9': '16:9', '9:16': '9:16',
    '1:1': '1:1', '4:5': '4:5', '4:3': '4:3', '3:4': '3:4',
}


class AiEditView(APIView):
    """POST /api/creatives/<pk>/ai-edit/
    Body: { prompt, aspect_ratio }
    Calls fal-ai/nano-banana-2/edit with the creative's image and saves the
    result as a new GeneratedCreative in the same workspace/campaign.
    Returns: { id, image_url, description }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        ws = get_workspace(request)
        if not ws:
            return Response(status=404)
        creative = ws.creatives.filter(pk=pk).first()
        if not creative:
            return Response(status=404)

        ok, err = _check_credits(ws, 1)
        if not ok:
            return err

        prompt = (request.data.get('prompt') or '').strip()
        if not prompt:
            return Response({'error': 'prompt is required'}, status=400)

        raw_ratio = request.data.get('aspect_ratio', 'auto')
        aspect_ratio = _AI_RATIO_MAP.get(raw_ratio, 'auto')

        image_url = (request.data.get('source_image_url') or '').strip() or creative.image_url
        if not image_url:
            return Response({'error': 'Creative has no image URL'}, status=400)

        os.environ['FAL_KEY'] = settings.FAL_KEY
        try:
            result = fal_client.subscribe(
                'fal-ai/nano-banana-2/edit',
                arguments={
                    'prompt': prompt,
                    'image_urls': [image_url],
                    'aspect_ratio': aspect_ratio,
                    'output_format': 'png',
                    'safety_tolerance': '4',
                    'num_images': 1,
                },
            )
        except Exception as exc:
            return Response({'error': str(exc)}, status=502)

        images = result.get('images') or []
        if not images:
            return Response({'error': 'No images returned from model'}, status=502)

        out_url = images[0].get('url')
        if not out_url:
            return Response({'error': 'Model returned empty URL'}, status=502)

        # The model can return a different shape than the source creative
        # (that's the whole point of the ratio picker) — label it from the
        # actual output pixels rather than copying the pre-edit value.
        result_aspect_ratio = creative.aspect_ratio
        try:
            with PILImage.open(io.BytesIO(_fetch_bytes(out_url))) as im:
                result_aspect_ratio = aspect_ratio_label_from_size(*im.size)
        except Exception:
            pass

        new_creative = GeneratedCreative.objects.create(
            workspace=ws,
            campaign=creative.campaign,
            name=_build_creative_name(ws, media_type='Photo', aspect_ratio=result_aspect_ratio),
            image_url=out_url,
            media_type='Photo',
            aspect_ratio=result_aspect_ratio,
            source=creative.source,
            created_by=request.user,
            is_edited=True,
            in_gallery=False,
        )

        _deduct_credits(ws, 1, 'AI Edit')

        try:
            from apps.slack_integration.services import notify_slack_edit
            notify_slack_edit(ws, new_creative, user=request.user)
        except Exception:
            pass

        return Response({
            'id': str(new_creative.id),
            'image_url': out_url,
            'description': result.get('description') or '',
        })


class SaveCanvasView(APIView):
    """POST /api/creatives/save-canvas/
    Body: { image_data (data URL), name, campaign_id?, creative_id? }
    Decodes PNG from canvas, saves to media/canvas_edits/, creates GeneratedCreative.
    When `creative_id` names the creative being edited, the result inherits its
    source/campaign/model attribution instead of always being marked 'uploaded'.
    Returns: { id, image_url }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import base64
        import uuid as uuid_lib
        from django.core.files.base import ContentFile
        from django.core.files.storage import default_storage

        ws = get_workspace(request)
        if not ws:
            return Response(status=404)

        raw = request.data.get('image_data', '')
        if not raw:
            return Response({'error': 'image_data is required'}, status=400)

        try:
            payload = raw.split(',', 1)[1] if ',' in raw else raw
            image_bytes = base64.b64decode(payload)
        except Exception:
            return Response({'error': 'Invalid image_data'}, status=400)

        name = (request.data.get('name') or 'Canvas Edit').strip()[:255]

        source_creative = None
        if request.data.get('creative_id'):
            source_creative = ws.creatives.filter(id=request.data['creative_id']).first()

        campaign = None
        if request.data.get('campaign_id'):
            campaign = ws.campaigns.filter(id=request.data['campaign_id']).first()
        elif source_creative:
            campaign = source_creative.campaign

        filename = f'canvas_edits/{uuid_lib.uuid4().hex}.png'
        path = default_storage.save(filename, ContentFile(image_bytes))
        url = request.build_absolute_uri(f'/media/{path}')

        # The canvas may have been cropped/resized in the editor, so its real
        # shape can genuinely differ from the source creative's — label it
        # from the actual exported pixels instead of copying the stale value.
        aspect_ratio = source_creative.aspect_ratio if source_creative else '1:1'
        try:
            with PILImage.open(io.BytesIO(image_bytes)) as im:
                aspect_ratio = aspect_ratio_label_from_size(*im.size)
        except Exception:
            pass

        creative = GeneratedCreative.objects.create(
            workspace=ws,
            campaign=campaign,
            name=name,
            image_url=url,
            media_type='Photo',
            aspect_ratio=aspect_ratio,
            source=source_creative.source if source_creative else 'uploaded',
            created_by=request.user,
            uploaded_by=(source_creative.uploaded_by if source_creative else request.user),
            is_edited=True,
            in_gallery=True,
        )

        try:
            from apps.slack_integration.services import notify_slack_edit
            notify_slack_edit(ws, creative, user=request.user)
        except Exception:
            pass

        return Response(GeneratedCreativeSerializer(creative, context={'request': request}).data, status=201)


class CreativeLogoPlacementView(APIView):
    """GET /api/creatives/<pk>/logo-placement/?logo_id=X
    Uses OpenCV to find the least-busy region in this creative and returns
    the recommended placement for the given logo.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        from PIL import Image as PILImage
        from .services import _find_best_logo_position, _fetch_bytes

        ws = get_workspace(request)
        creative = ws.creatives.filter(pk=pk).first()
        if not creative:
            return Response(status=404)

        logo_id = request.query_params.get('logo_id')
        logo = ws.logos.filter(id=logo_id).first() if logo_id else None
        if not logo:
            return Response({'error': 'logo not found'}, status=400)

        try:
            logo_pil = PILImage.open(logo.file.path).convert('RGBA')
            natural_w, natural_h = logo_pil.size
            bbox = logo_pil.split()[-1].getbbox()
            trim_left, trim_top, trim_right, trim_bottom = bbox if bbox else (0, 0, natural_w, natural_h)
            trimmed_w = max(1, trim_right - trim_left)
            trimmed_h = max(1, trim_bottom - trim_top)

            img_bytes = _fetch_bytes(creative.image_url)
            img_pil = PILImage.open(__import__('io').BytesIO(img_bytes))
            img_w, img_h = img_pil.size

            scale = min(int(img_w * 0.24) / trimmed_w, int(img_h * 0.20) / trimmed_h, 1.0)
            logo_w = max(1, int(trimmed_w * scale))
            logo_h = max(1, int(trimmed_h * scale))

            x, y, _ = _find_best_logo_position(img_bytes, logo_w, logo_h)
            x = max(0, min(x, img_w - logo_w))
            y = max(0, min(y, img_h - logo_h))

            return Response({
                'x': x, 'y': y,
                'logo_w': logo_w, 'logo_h': logo_h,
                'img_w': img_w, 'img_h': img_h,
                'trim_left': trim_left, 'trim_top': trim_top,
                'trimmed_w': trimmed_w, 'trimmed_h': trimmed_h,
                'logo_url': request.build_absolute_uri(logo.file.url),
            })
        except Exception as exc:
            return Response({'error': str(exc)}, status=502)


class EraseView(APIView):
    """POST /api/creatives/<pk>/erase/
    Body: { source_image_url, mask_data (base64 PNG data URL), prompt }
    Saves mask to media/masks/, calls fal-ai/flux-fill for inpainting.
    Returns: { id, image_url } — saved with in_gallery=False.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        import base64

        ws = get_workspace(request)
        if not ws:
            return Response(status=404)
        creative = ws.creatives.filter(pk=pk).first()
        if not creative:
            return Response(status=404)

        ok, err = _check_credits(ws, 1)
        if not ok:
            return err

        source_url = (request.data.get('source_image_url') or '').strip() or creative.image_url
        mask_data = request.data.get('mask_data', '')

        if not mask_data:
            return Response({'error': 'mask_data is required'}, status=400)

        try:
            payload = mask_data.split(',', 1)[1] if ',' in mask_data else mask_data
            mask_bytes = base64.b64decode(payload)
        except Exception:
            return Response({'error': 'Invalid mask_data'}, status=400)

        os.environ['FAL_KEY'] = settings.FAL_KEY
        try:
            mask_url = fal_client.upload(mask_bytes, 'image/png')
        except Exception as exc:
            return Response({'error': f'Mask upload failed: {exc}'}, status=502)

        try:
            result = fal_client.subscribe(
                'fal-ai/bria/eraser',
                arguments={
                    'image_url': source_url,
                    'mask_url': mask_url,
                    'mask_type': 'manual',
                },
            )
        except Exception as exc:
            return Response({'error': str(exc)}, status=502)

        out_url = (result.get('image') or {}).get('url')
        if not out_url:
            return Response({'error': 'Model returned empty URL'}, status=502)

        new_creative = GeneratedCreative.objects.create(
            workspace=ws,
            campaign=creative.campaign,
            name=_build_creative_name(ws, media_type='Photo', aspect_ratio=creative.aspect_ratio),
            image_url=out_url,
            media_type='Photo',
            aspect_ratio=creative.aspect_ratio,
            source=creative.source,
            created_by=request.user,
            is_edited=True,
            in_gallery=False,
        )
        _deduct_credits(ws, 1, 'Erase & Fill')

        return Response({'id': str(new_creative.id), 'image_url': out_url})
