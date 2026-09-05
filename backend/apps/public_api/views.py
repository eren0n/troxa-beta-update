import mimetypes

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.billing.models import Subscription
from apps.creatives.models import GenerationJob, GeneratedCreative
from apps.creatives.services import generate_job_async
from apps.activity.utils import log_event
from .authentication import APIKeyAuthentication

VALID_RATIOS = {'1:1', '4:3', '3:4', '16:9', '9:16', '4:5', '5:4'}
VALID_STYLES = {'realistic', 'cartoon', 'textbased', ''}

ALLOWED_MIME_PREFIXES = ('image/jpeg', 'image/png', 'image/webp', 'image/gif')


def _check_credits(ws, num_images):
    try:
        sub = ws.subscription
    except Subscription.DoesNotExist:
        return False, Response({'error': 'No credit account found.'}, status=402)
    if sub.plan.unlimited_usage:
        return True, None
    available = sub.credits_available
    if available < num_images:
        return False, Response(
            {'error': 'Insufficient credits.', 'balance': available, 'required': num_images},
            status=402,
        )
    return True, None


def _serialize_reference(c, request):
    return {
        'id':           str(c.id),
        'name':         c.name,
        'url':          c.image_url,
        'aspect_ratio': c.aspect_ratio,
        'uploaded_at':  c.created_at.isoformat(),
    }


class ReferencesView(APIView):
    """Upload and list reference images used in generation."""
    authentication_classes = [APIKeyAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        ws = request.workspace
        refs = ws.creatives.filter(
            source='uploaded', media_type='Photo'
        ).order_by('-created_at')[:100]
        return Response([_serialize_reference(c, request) for c in refs])

    def post(self, request):
        ws = request.workspace
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'file is required (multipart/form-data).'}, status=400)

        mime = file.content_type or mimetypes.guess_type(file.name)[0] or ''
        if not any(mime.startswith(p) for p in ALLOWED_MIME_PREFIXES):
            return Response({'error': 'Only JPEG, PNG, WebP, or GIF images are accepted.'}, status=400)

        if file.size > 20 * 1024 * 1024:
            return Response({'error': 'File too large. Maximum size is 20 MB.'}, status=400)

        # Auto-detect aspect ratio from real pixel dimensions
        aspect_ratio = '1:1'
        try:
            from PIL import Image as PILImage, ImageOps
            file.seek(0)
            with PILImage.open(file) as im:
                im = ImageOps.exif_transpose(im)
                w, h = im.size
                from apps.creatives.views import aspect_ratio_label_from_size
                aspect_ratio = aspect_ratio_label_from_size(w, h)
            file.seek(0)
        except Exception:
            pass

        name = request.data.get('name') or file.name
        creative = GeneratedCreative(
            workspace=ws,
            name=name,
            media_type='Photo',
            aspect_ratio=aspect_ratio,
            source='uploaded',
            uploaded_by=request.user,
            created_by=request.user,
            in_gallery=True,
        )
        creative.uploaded_file.save(file.name, file, save=False)
        creative.image_url = request.build_absolute_uri(creative.uploaded_file.url)
        creative.save()

        log_event(ws, request.user, 'creative_uploaded', f'API reference upload: {name}')
        return Response(_serialize_reference(creative, request), status=201)


class GenerateView(APIView):
    authentication_classes = [APIKeyAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ws = request.workspace

        try:
            num_images = max(1, min(int(request.data.get('num_images', 1)), 4))
        except (TypeError, ValueError):
            return Response({'error': 'num_images must be an integer between 1 and 4.'}, status=400)
        ok, err = _check_credits(ws, num_images)
        if not ok:
            return err

        aspect_ratio = request.data.get('aspect_ratio', '1:1')
        if aspect_ratio not in VALID_RATIOS:
            return Response({'error': f'Invalid aspect_ratio. Valid values: {sorted(VALID_RATIOS)}'}, status=400)

        style = request.data.get('style', '')
        if style not in VALID_STYLES:
            return Response({'error': f'Invalid style. Valid values: {sorted(VALID_STYLES - {""})}'}, status=400)

        campaign = None
        campaign_id = request.data.get('campaign_id')
        if campaign_id:
            campaign = ws.campaigns.filter(id=campaign_id).first()
            if not campaign:
                return Response({'error': 'Campaign not found.'}, status=404)

        job = GenerationJob.objects.create(
            workspace=ws,
            created_by=request.user,
            campaign=campaign,
            aspect_ratio=aspect_ratio,
            num_images=num_images,
            style=style,
            extra_prompt=request.data.get('prompt', ''),
            generation_mode='auto',
            model_name='Nano Banana 2',
            resolution='1K',
            output_format='png',
            image_quality='high',
        )

        reference_ids = request.data.get('reference_ids', [])
        if reference_ids:
            refs = ws.creatives.filter(id__in=reference_ids, media_type='Photo')
            job.reference_creatives.set(refs)

        log_event(ws, request.user, 'generation_started', f'API generation job #{job.id} queued')
        generate_job_async(job.id)

        return Response({
            'job_id':     str(job.id),
            'status':     job.status,
            'num_images': num_images,
            'status_url': f'/api/v1/jobs/{job.id}/',
        }, status=202)


class JobStatusView(APIView):
    authentication_classes = [APIKeyAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, job_id):
        ws = request.workspace
        try:
            job = ws.generation_jobs.prefetch_related('creatives').get(pk=job_id)
        except GenerationJob.DoesNotExist:
            return Response({'error': 'Job not found.'}, status=404)

        creatives = []
        if job.status == 'done':
            for c in job.creatives.filter(media_type='Photo'):
                creatives.append({
                    'id':  str(c.id),
                    'url': c.image_url,
                })

        return Response({
            'job_id':     str(job.id),
            'status':     job.status,
            'creatives':  creatives,
            'created_at': job.created_at.isoformat(),
        })
