import logging
import mimetypes
import threading
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

logger = logging.getLogger(__name__)

from apps.accounts.views import get_workspace, require_editor, require_admin

# ── MIME validation ────────────────────────────────────────────────────────────
_ALLOWED_IMAGE_MIME = ('image/jpeg', 'image/png', 'image/webp', 'image/gif')


def _check_image_mime(file):
    """Return (ok: bool, error_msg: str|None). True = file is an allowed image."""
    mime = file.content_type or mimetypes.guess_type(file.name)[0] or ''
    if not any(mime.startswith(p) for p in _ALLOWED_IMAGE_MIME):
        return False, 'Only JPEG, PNG, WebP, or GIF images are accepted.'
    return True, None
from apps.activity.utils import log_event
from .models import Campaign, Logo, Cta, Promo, WinningStatic, Disclaimer, Character, CharacterImage, DisclaimerKeyword, PalettePreset, TypographyPreset
from .serializers import CampaignSerializer, LogoSerializer, CtaSerializer, PromoSerializer, WinningStaticSerializer, DisclaimerSerializer


def _trigger_fingerprint_brand_kit(workspace_id):
    """Trigger Agent 2 (brand kit analysis) in background. Lazy import prevents circular deps."""
    try:
        from apps.fingerprint.services import trigger_analyze_brand_kit
        trigger_analyze_brand_kit(workspace_id)
    except Exception:
        pass  # never block the main request


def _trigger_fingerprint_gallery(static_id):
    """Trigger Agent 1 (visual analysis) for a gallery upload in background."""
    try:
        from apps.fingerprint.services import trigger_analyze_gallery
        trigger_analyze_gallery(static_id)
    except Exception:
        pass


def paginate(queryset, request, serializer_cls, context=None, serialize=None):
    """Opt-in limit/offset pagination — only kicks in when the caller passes ?limit=.
    Existing callers that never send limit/offset keep getting the plain list they always have,
    so this doesn't change the contract for pages that fetch the full collection at once."""
    try:
        limit = max(0, int(request.query_params.get('limit', 0)))
        offset = max(0, int(request.query_params.get('offset', 0)))
    except (TypeError, ValueError):
        limit, offset = 0, 0
    total = queryset.count()
    page = queryset[offset:offset + limit]
    results = serialize(page) if serialize else serializer_cls(page, many=True, context=context or {}).data
    return {'results': results, 'total': total, 'has_more': offset + limit < total}


class CampaignView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        return Response(CampaignSerializer(ws.campaigns.all().order_by('-created_at'), many=True).data)

    def post(self, request):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Analysts cannot create campaigns.'}, status=403)
        name = request.data.get('name', '').strip()
        if not name:
            return Response({'detail': 'Name required.'}, status=400)
        try:
            c = Campaign.objects.create(
                workspace=ws,
                name=name,
                created_by=request.user,
                target_audience=request.data.get('target_audience', '').strip(),
                target_region=request.data.get('target_region', '').strip(),
                objective=request.data.get('objective', '').strip(),
                campaign_brief=request.data.get('campaign_brief', '').strip(),
            )
        except Exception:
            return Response({'detail': 'Campaign already exists.'}, status=400)
        log_event(ws, request.user, 'campaign_created', f'Campaign "{name}" created')
        return Response(CampaignSerializer(c).data, status=201)


class CampaignDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, ws, pk):
        return ws.campaigns.filter(id=pk).first()

    def patch(self, request, pk):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Analysts cannot edit campaigns.'}, status=403)
        c = self._get(ws, pk)
        if not c:
            return Response(status=404)
        updated_fields = []
        for field in ('name', 'target_audience', 'target_region', 'objective', 'campaign_brief'):
            if field in request.data:
                val = request.data[field]
                setattr(c, field, val.strip() if isinstance(val, str) else val)
                updated_fields.append(field)
        if updated_fields:
            c.save(update_fields=updated_fields)
        return Response(CampaignSerializer(c).data)

    def delete(self, request, pk):
        ws = get_workspace(request)
        if not require_admin(request.user, ws):
            return Response({'detail': 'Only admins can delete campaigns.'}, status=403)
        c = self._get(ws, pk)
        if not c:
            return Response(status=404)
        c.delete()
        return Response(status=204)


class LogoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        logos = ws.logos.all().order_by('-uploaded_at')
        if request.query_params.get('limit') is not None:
            return Response(paginate(logos, request, LogoSerializer, context={'request': request}))
        return Response(LogoSerializer(logos, many=True, context={'request': request}).data)

    def post(self, request):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Analysts cannot upload logos.'}, status=403)
        files = request.FILES.getlist('file')
        if not files:
            return Response({'detail': 'File required.'}, status=400)
        created = []
        for file in files:
            ok, err = _check_image_mime(file)
            if not ok:
                return Response({'detail': err}, status=400)
            name = file.name.rsplit('.', 1)[0]
            logo = Logo.objects.create(workspace=ws, file=file, name=name)
            log_event(ws, request.user, 'logo_uploaded', f'Logo "{name}" uploaded')
            created.append(LogoSerializer(logo, context={'request': request}).data)
        _trigger_fingerprint_brand_kit(ws.id)
        return Response(created, status=201)


class LogoDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Analysts cannot edit logos.'}, status=403)
        try:
            logo = ws.logos.get(id=pk)
        except Logo.DoesNotExist:
            return Response(status=404)
        if request.data.get('is_primary'):
            ws.logos.exclude(pk=pk).update(is_primary=False)
            logo.is_primary = True
            logo.save(update_fields=['is_primary'])
        return Response(LogoSerializer(logo, context={'request': request}).data)

    def delete(self, request, pk):
        ws = get_workspace(request)
        if not require_admin(request.user, ws):
            return Response({'detail': 'Only admins can delete logos.'}, status=403)
        try:
            logo = ws.logos.get(id=pk)
            logo.delete()
            return Response(status=204)
        except Logo.DoesNotExist:
            return Response(status=404)


class CtaView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        return Response(CtaSerializer(ws.ctas.all().order_by('-uploaded_at'), many=True, context={'request': request}).data)

    def post(self, request):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Editors only.'}, status=403)
        files = request.FILES.getlist('file')
        if not files:
            return Response({'detail': 'File required.'}, status=400)
        created = []
        for file in files:
            ok, err = _check_image_mime(file)
            if not ok:
                return Response({'detail': err}, status=400)
            name = file.name.rsplit('.', 1)[0]
            cta = Cta.objects.create(workspace=ws, file=file, name=name)
            created.append(CtaSerializer(cta, context={'request': request}).data)
        _trigger_fingerprint_brand_kit(ws.id)
        return Response(created, status=201)


class CtaDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Editors only.'}, status=403)
        try:
            cta = ws.ctas.get(id=pk)
        except Cta.DoesNotExist:
            return Response(status=404)
        if request.data.get('is_primary'):
            ws.ctas.exclude(pk=pk).update(is_primary=False)
            cta.is_primary = True
            cta.save(update_fields=['is_primary'])
        if 'name' in request.data:
            cta.name = request.data['name']
            cta.save(update_fields=['name'])
        return Response(CtaSerializer(cta, context={'request': request}).data)

    def delete(self, request, pk):
        ws = get_workspace(request)
        if not require_admin(request.user, ws):
            return Response({'detail': 'Admins only.'}, status=403)
        try:
            ws.ctas.get(id=pk).delete()
        except Cta.DoesNotExist:
            return Response(status=404)
        return Response(status=204)


class PromoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        return Response(PromoSerializer(ws.promos.all().order_by('-uploaded_at'), many=True, context={'request': request}).data)

    def post(self, request):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Editors only.'}, status=403)
        files = request.FILES.getlist('file')
        if not files:
            return Response({'detail': 'File required.'}, status=400)
        created = []
        for file in files:
            ok, err = _check_image_mime(file)
            if not ok:
                return Response({'detail': err}, status=400)
            name = file.name.rsplit('.', 1)[0]
            promo = Promo.objects.create(workspace=ws, file=file, name=name)
            created.append(PromoSerializer(promo, context={'request': request}).data)
            # Extract verbatim promo text in background (Agent 1 vision)
            try:
                from apps.fingerprint.services import trigger_extract_promo_text
                trigger_extract_promo_text(promo.id)
            except Exception:
                pass
        _trigger_fingerprint_brand_kit(ws.id)
        return Response(created, status=201)


class PromoDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Editors only.'}, status=403)
        try:
            promo = ws.promos.get(id=pk)
        except Promo.DoesNotExist:
            return Response(status=404)
        if request.data.get('is_primary'):
            ws.promos.exclude(pk=pk).update(is_primary=False)
            promo.is_primary = True
            promo.save(update_fields=['is_primary'])
        if 'name' in request.data:
            promo.name = request.data['name']
            promo.save(update_fields=['name'])
        return Response(PromoSerializer(promo, context={'request': request}).data)

    def delete(self, request, pk):
        ws = get_workspace(request)
        if not require_admin(request.user, ws):
            return Response({'detail': 'Admins only.'}, status=403)
        try:
            ws.promos.get(id=pk).delete()
        except Promo.DoesNotExist:
            return Response(status=404)
        return Response(status=204)


class StaticView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        statics = ws.statics.all().order_by('-uploaded_at')
        category = request.query_params.get('category')
        if category is not None:
            statics = statics.filter(category=category)
        return Response(WinningStaticSerializer(statics, many=True, context={'request': request}).data)

    def post(self, request):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Analysts cannot upload reference photos.'}, status=403)
        files = request.FILES.getlist('file')
        if not files:
            return Response({'detail': 'File required.'}, status=400)
        category = request.data.get('category', '')
        created = []
        for file in files:
            ok, err = _check_image_mime(file)
            if not ok:
                return Response({'detail': err}, status=400)
            name = request.data.get('name', '') or file.name.rsplit('.', 1)[0]
            static = WinningStatic.objects.create(workspace=ws, file=file, name=name, category=category)
            log_event(ws, request.user, 'static_uploaded', f'Reference photo "{name}" uploaded')
            threading.Thread(target=_caption_static, args=(static.pk,), daemon=True).start()
            _trigger_fingerprint_gallery(static.pk)
            created.append(WinningStaticSerializer(static, context={'request': request}).data)
        return Response(created, status=201)


class StaticDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        ws = get_workspace(request)
        if not require_admin(request.user, ws):
            return Response({'detail': 'Only admins can delete reference photos.'}, status=403)
        try:
            static = ws.statics.get(id=pk)
            static.delete()
            return Response(status=204)
        except WinningStatic.DoesNotExist:
            return Response(status=404)


class DisclaimerView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        return Response(DisclaimerSerializer(ws.disclaimers.all().order_by('-created_at'), many=True).data)

    def post(self, request):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Analysts cannot create disclaimers.'}, status=403)
        text = request.data.get('text', '').strip()
        if not text:
            return Response({'detail': 'Text required.'}, status=400)
        d = Disclaimer.objects.create(
            workspace=ws,
            text=text,
            name=request.data.get('name', ''),
            category=request.data.get('category', 'General'),
            is_default=bool(request.data.get('is_default', False)),
        )
        log_event(ws, request.user, 'disclaimer_created', f'Disclaimer "{d.name or d.id}" created')
        return Response(DisclaimerSerializer(d).data, status=201)


class DisclaimerDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, ws, pk):
        return ws.disclaimers.filter(id=pk).first()

    def patch(self, request, pk):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Analysts cannot edit disclaimers.'}, status=403)
        d = self._get(ws, pk)
        if not d:
            return Response(status=404)
        if request.data.get('is_default'):
            ws.disclaimers.exclude(pk=pk).update(is_default=False)
        for field in ('text', 'name', 'category', 'is_default'):
            if field in request.data:
                setattr(d, field, request.data[field])
        d.save()
        return Response(DisclaimerSerializer(d).data)

    def delete(self, request, pk):
        ws = get_workspace(request)
        if not require_admin(request.user, ws):
            return Response({'detail': 'Only admins can delete disclaimers.'}, status=403)
        d = self._get(ws, pk)
        if not d:
            return Response(status=404)
        d.delete()
        return Response(status=204)


def _caption_static(static_id):
    import os
    import fal_client
    from django.conf import settings

    try:
        static = WinningStatic.objects.get(id=static_id)
        static.caption_status = 'processing'
        static.save(update_fields=['caption_status'])

        os.environ['FAL_KEY'] = settings.FAL_KEY

        url = fal_client.upload_file(static.file.path)
        result = fal_client.subscribe(
            'fal-ai/florence-2-large/more-detailed-caption',
            arguments={'image_url': url},
        )

        caption_text = result.get('results', '') if isinstance(result, dict) else str(result)
        static.caption = caption_text
        static.caption_status = 'done' if caption_text else 'error'
        static.save(update_fields=['caption', 'caption_status'])

    except Exception:
        WinningStatic.objects.filter(id=static_id).update(caption_status='error')


def _caption_character_image(img_id):
    import os
    import fal_client
    from django.conf import settings

    try:
        img = CharacterImage.objects.get(id=img_id)
        img.caption_status = 'processing'
        img.save(update_fields=['caption_status'])

        os.environ['FAL_KEY'] = settings.FAL_KEY

        url = fal_client.upload_file(img.file.path)
        result = fal_client.subscribe(
            'fal-ai/florence-2-large/more-detailed-caption',
            arguments={'image_url': url},
        )

        caption_text = result.get('results', '') if isinstance(result, dict) else str(result)
        img.caption = caption_text
        img.caption_status = 'done' if caption_text else 'error'
        img.save(update_fields=['caption', 'caption_status'])

    except Exception:
        CharacterImage.objects.filter(id=img_id).update(caption_status='error')


class CharacterView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        chars = ws.characters.prefetch_related('images').all()
        if request.query_params.get('limit') is not None:
            return Response(paginate(chars, request, None, serialize=lambda page: [_serialize_character(c) for c in page]))
        return Response([_serialize_character(c) for c in chars])

    def post(self, request):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Editors only.'}, status=403)
        name = request.data.get('name', '').strip()
        if not name:
            return Response({'detail': 'Name required.'}, status=400)
        try:
            char = Character.objects.create(workspace=ws, name=name, description=request.data.get('description', ''))
        except Exception:
            return Response({'detail': 'Character name already exists.'}, status=400)
        return Response(_serialize_character(char), status=201)


class CharacterDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, ws, pk):
        return ws.characters.filter(pk=pk).prefetch_related('images').first()

    def patch(self, request, pk):
        ws = get_workspace(request)
        char = self._get(ws, pk)
        if not char:
            return Response(status=404)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Editors only.'}, status=403)
        if 'name' in request.data:
            char.name = request.data['name'].strip() or char.name
        if 'description' in request.data:
            char.description = request.data['description']
        char.save()
        return Response(_serialize_character(char))

    def delete(self, request, pk):
        ws = get_workspace(request)
        char = self._get(ws, pk)
        if not char:
            return Response(status=404)
        if not require_admin(request.user, ws):
            return Response({'detail': 'Admins only.'}, status=403)
        char.delete()
        return Response(status=204)


class CharacterImageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        ws = get_workspace(request)
        char = ws.characters.filter(pk=pk).prefetch_related('images').first()
        if not char:
            return Response(status=404)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Editors only.'}, status=403)
        file = request.FILES.get('file')
        if not file:
            return Response({'detail': 'File required.'}, status=400)
        ok, err = _check_image_mime(file)
        if not ok:
            return Response({'detail': err}, status=400)
        img = CharacterImage.objects.create(character=char, file=file)
        threading.Thread(target=_caption_character_image, args=(img.pk,), daemon=True).start()
        return Response({'id': img.id, 'url': request.build_absolute_uri(img.file.url), 'caption_status': img.caption_status}, status=201)


class CharacterImageDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk, img_pk):
        ws = get_workspace(request)
        char = ws.characters.filter(pk=pk).first()
        if not char:
            return Response(status=404)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Editors only.'}, status=403)
        img = char.images.filter(pk=img_pk).first()
        if not img:
            return Response(status=404)
        img.file.delete(save=False)
        img.delete()
        return Response(status=204)


def _serialize_character(char):
    return {
        'id': str(char.id),
        'name': char.name,
        'description': char.description,
        'created_at': char.created_at.isoformat(),
        'images': [
            {'id': img.id, 'url': img.file.url, 'caption_status': img.caption_status}
            for img in char.images.all()
        ],
    }


class CharacterGenerateView(APIView):
    """
    POST /api/brand-kit/characters/generate/
    Accepts multipart/form-data:
      - name (str, required)
      - prompt (str, optional)
      - files (File[], images of the character to pass as reference)
      - static_ids (int[], existing WinningStatic IDs to use as reference)
    Pipeline: upload refs → nano-banana-pro/edit (white-bg character) → pixelcut bg removal → save CharacterImage
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import os
        import uuid
        import tempfile
        import requests as http_requests
        import fal_client
        from django.conf import settings
        from django.core.files.base import ContentFile

        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Editors only.'}, status=403)

        name = request.data.get('name', '').strip()
        if not name:
            return Response({'detail': 'Name required.'}, status=400)

        prompt = request.data.get('prompt', '').strip()
        model = request.data.get('model', 'nano-banana')  # 'nano-banana' | 'gpt-image-2'
        static_ids = request.data.getlist('static_ids') or request.data.getlist('static_ids[]')
        uploaded_files = request.FILES.getlist('files')

        os.environ['FAL_KEY'] = settings.FAL_KEY

        try:
            # --- Collect image_urls for fal.ai ---
            image_urls = []

            if static_ids:
                statics = ws.statics.filter(id__in=static_ids)
                for s in statics:
                    try:
                        url = fal_client.upload_file(s.file.path)
                        image_urls.append(url)
                    except Exception:
                        pass

            tmp_paths = []
            for f in uploaded_files:
                suffix = os.path.splitext(f.name)[1] or '.png'
                with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                    for chunk in f.chunks():
                        tmp.write(chunk)
                    tmp_paths.append(tmp.name)
            for path in tmp_paths:
                try:
                    url = fal_client.upload_file(path)
                    image_urls.append(url)
                except Exception:
                    pass
                finally:
                    try:
                        os.unlink(path)
                    except Exception:
                        pass

            # --- Step 1: generate ---
            user_prompt = prompt if prompt else (
                "Render this character on a clean white background, centered, with professional studio lighting."
            )

            if model == 'gpt-image-2':
                if image_urls:
                    edit_result = fal_client.subscribe(
                        "openai/gpt-image-2/edit",
                        arguments={
                            "prompt": user_prompt,
                            "image_urls": image_urls,
                            "quality": "high",
                            "output_format": "png",
                            "num_images": 1,
                        },
                    )
                else:
                    edit_result = fal_client.subscribe(
                        "openai/gpt-image-2",
                        arguments={
                            "prompt": user_prompt,
                            "quality": "high",
                            "output_format": "png",
                            "num_images": 1,
                        },
                    )
            elif image_urls:
                system_prompt = (
                    "You are a senior graphic designer and character artist with 15 years of studio experience. "
                    "Using the provided reference images, produce a single clean character image on a pure white background. "
                    "The character must be the sole subject — no scene, no props, no environment, no backdrop. "
                    "Center the character, ensure professional studio lighting, and make the result suitable for compositing into advertising creatives. "
                    "Do NOT include any text, labels, watermarks, or logos in the output."
                )
                edit_result = fal_client.subscribe(
                    "fal-ai/nano-banana-pro/edit",
                    arguments={
                        "prompt": user_prompt,
                        "image_urls": image_urls,
                        "system_prompt": system_prompt,
                        "output_format": "png",
                        "resolution": "1K",
                        "num_images": 1,
                    },
                )
            else:
                system_prompt = (
                    "You are a senior graphic designer and character artist with 15 years of studio experience. "
                    "Produce a single clean character image on a pure white background. "
                    "The character must be the sole subject — no scene, no props, no environment, no backdrop. "
                    "Center the character, ensure professional studio lighting, and make the result suitable for compositing into advertising creatives. "
                    "Do NOT include any text, labels, watermarks, or logos in the output."
                )
                edit_result = fal_client.subscribe(
                    "fal-ai/nano-banana-pro",
                    arguments={
                        "prompt": user_prompt,
                        "system_prompt": system_prompt,
                        "output_format": "png",
                        "resolution": "1K",
                        "num_images": 1,
                    },
                )

            generated_url = edit_result['images'][0]['url']

            # --- Step 2: pixelcut background removal ---
            bg_result = fal_client.subscribe(
                "pixelcut/background-removal",
                arguments={
                    "image_url": generated_url,
                    "output_format": "rgba",
                    "sync_mode": True,
                },
            )

            final_url = bg_result['image']['url']

            # --- Step 3: Download / decode final image ---
            # pixelcut returns a data URI when sync_mode=True; otherwise a plain HTTPS URL.
            if final_url.startswith('data:'):
                import base64 as _b64
                _header, _encoded = final_url.split(',', 1)
                img_content = _b64.b64decode(_encoded)
            else:
                img_resp = http_requests.get(final_url, timeout=60)
                img_resp.raise_for_status()
                img_content = img_resp.content

        except Exception as e:
            return Response({'detail': f'Generation failed: {str(e)}'}, status=500)

        # --- Step 4: Create Character + CharacterImage ---
        try:
            char = Character.objects.create(workspace=ws, name=name, description=prompt)
        except Exception:
            return Response({'detail': 'Character name already exists.'}, status=400)

        img = CharacterImage(character=char)
        img.file.save(f"{uuid.uuid4()}.png", ContentFile(img_content), save=False)
        img.caption_status = 'pending'
        img.save()

        threading.Thread(target=_caption_character_image, args=(img.pk,), daemon=True).start()

        return Response(_serialize_character(char), status=201)


class StaticGenerateView(APIView):
    """
    POST /api/brand-kit/statics/generate/
    Accepts multipart/form-data:
      - name (str, required)
      - prompt (str, optional — may contain #Image1 / #Image2 index references)
      - files (File[], uploaded reference images)
      - static_ids (int[], existing WinningStatic IDs as references)
    Pipeline: upload refs → nano-banana-pro/edit (environment/backdrop) → save as WinningStatic
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import os
        import uuid
        import tempfile
        import requests as http_requests
        import fal_client
        from django.conf import settings
        from django.core.files.base import ContentFile

        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Editors only.'}, status=403)

        name = request.data.get('name', '').strip()
        if not name:
            return Response({'detail': 'Name required.'}, status=400)

        prompt = request.data.get('prompt', '').strip()
        model = request.data.get('model', 'nano-banana')  # 'nano-banana' | 'gpt-image-2'
        static_ids = request.data.getlist('static_ids') or request.data.getlist('static_ids[]')
        uploaded_files = request.FILES.getlist('files')

        os.environ['FAL_KEY'] = settings.FAL_KEY

        try:
            image_urls = []

            if static_ids:
                statics = ws.statics.filter(id__in=static_ids)
                for s in statics:
                    try:
                        url = fal_client.upload_file(s.file.path)
                        image_urls.append(url)
                    except Exception:
                        pass

            tmp_paths = []
            for f in uploaded_files:
                suffix = os.path.splitext(f.name)[1] or '.png'
                with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                    for chunk in f.chunks():
                        tmp.write(chunk)
                    tmp_paths.append(tmp.name)
            for path in tmp_paths:
                try:
                    url = fal_client.upload_file(path)
                    image_urls.append(url)
                except Exception:
                    pass
                finally:
                    try:
                        os.unlink(path)
                    except Exception:
                        pass

            user_prompt = prompt if prompt else (
                "Create a clean, photorealistic environment backdrop with professional lighting, suitable for product photography."
            )

            if model == 'gpt-image-2':
                if image_urls:
                    edit_result = fal_client.subscribe(
                        "openai/gpt-image-2/edit",
                        arguments={
                            "prompt": user_prompt,
                            "image_urls": image_urls,
                            "quality": "high",
                            "output_format": "png",
                            "num_images": 1,
                        },
                    )
                else:
                    edit_result = fal_client.subscribe(
                        "openai/gpt-image-2",
                        arguments={
                            "prompt": user_prompt,
                            "quality": "high",
                            "output_format": "png",
                            "num_images": 1,
                        },
                    )
            elif image_urls:
                system_prompt = (
                    "You are a senior set designer and commercial photographer with 15 years of studio experience. "
                    "Using the provided reference images, produce a single clean environment or backdrop image "
                    "suitable for product and advertising photography. "
                    "The result must be a cohesive, photorealistic background scene — no floating objects, no cut-outs, "
                    "no text, no watermarks, no logos. "
                    "Ensure professional, even lighting and a composition that works as a backdrop for placing products or subjects in front of."
                )
                edit_result = fal_client.subscribe(
                    "fal-ai/nano-banana-pro/edit",
                    arguments={
                        "prompt": user_prompt,
                        "image_urls": image_urls,
                        "system_prompt": system_prompt,
                        "output_format": "png",
                        "resolution": "1K",
                        "num_images": 1,
                    },
                )
            else:
                system_prompt = (
                    "You are a senior set designer and commercial photographer with 15 years of studio experience. "
                    "Produce a single clean environment or backdrop image suitable for product and advertising photography. "
                    "The result must be a cohesive, photorealistic background scene — no floating objects, no cut-outs, "
                    "no text, no watermarks, no logos. "
                    "Ensure professional, even lighting and a composition that works as a backdrop for placing products or subjects in front of."
                )
                edit_result = fal_client.subscribe(
                    "fal-ai/nano-banana-pro",
                    arguments={
                        "prompt": user_prompt,
                        "system_prompt": system_prompt,
                        "output_format": "png",
                        "resolution": "1K",
                        "num_images": 1,
                    },
                )

            generated_url = edit_result['images'][0]['url']

            img_resp = http_requests.get(generated_url, timeout=60)
            img_resp.raise_for_status()
            img_content = img_resp.content

        except Exception as e:
            return Response({'detail': f'Generation failed: {str(e)}'}, status=500)

        static = WinningStatic(workspace=ws, name=name, category='environment')
        static.file.save(f"{uuid.uuid4()}.png", ContentFile(img_content), save=False)
        static.save()

        threading.Thread(target=_caption_static, args=(static.pk,), daemon=True).start()

        return Response(WinningStaticSerializer(static, context={'request': request}).data, status=201)


def _palette_data(p):
    return {'id': str(p.id), 'name': p.name, 'active': p.active, 'colors': p.colors}

def _typography_data(t):
    return {'id': str(t.id), 'name': t.name, 'active': t.active, 'heading': t.heading, 'body': t.body}


class PalettePresetView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        return Response([_palette_data(p) for p in ws.palette_presets.all()])

    def post(self, request):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Editors only.'}, status=403)
        p = PalettePreset.objects.create(
            workspace=ws,
            name=request.data.get('name', 'New Palette'),
            colors=request.data.get('colors', []),
        )
        _trigger_fingerprint_brand_kit(ws.id)
        return Response(_palette_data(p), status=201)


class PalettePresetDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Editors only.'}, status=403)
        try:
            p = ws.palette_presets.get(id=pk)
        except PalettePreset.DoesNotExist:
            return Response(status=404)
        if 'name' in request.data:
            p.name = request.data['name']
        if 'colors' in request.data:
            p.colors = request.data['colors']
        if 'active' in request.data:
            if request.data['active']:
                ws.palette_presets.exclude(id=pk).update(active=False)
            p.active = request.data['active']
        p.save()
        # Active palette change affects Agent 2 output
        if 'colors' in request.data or request.data.get('active'):
            _trigger_fingerprint_brand_kit(ws.id)
        return Response(_palette_data(p))

    def delete(self, request, pk):
        ws = get_workspace(request)
        if not require_admin(request.user, ws):
            return Response({'detail': 'Admins only.'}, status=403)
        try:
            ws.palette_presets.get(id=pk).delete()
        except PalettePreset.DoesNotExist:
            return Response(status=404)
        return Response(status=204)


class TypographyPresetView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        return Response([_typography_data(t) for t in ws.typography_presets.all()])

    def post(self, request):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Editors only.'}, status=403)
        t = TypographyPreset.objects.create(
            workspace=ws,
            name=request.data.get('name', 'New Typography'),
            heading=request.data.get('heading', 'Inter'),
            body=request.data.get('body', 'Inter'),
        )
        _trigger_fingerprint_brand_kit(ws.id)
        return Response(_typography_data(t), status=201)


class TypographyPresetDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Editors only.'}, status=403)
        try:
            t = ws.typography_presets.get(id=pk)
        except TypographyPreset.DoesNotExist:
            return Response(status=404)
        if 'name' in request.data:
            t.name = request.data['name']
        if 'heading' in request.data:
            t.heading = request.data['heading']
        if 'body' in request.data:
            t.body = request.data['body']
        if 'active' in request.data:
            if request.data['active']:
                ws.typography_presets.exclude(id=pk).update(active=False)
            t.active = request.data['active']
        t.save()
        # Font or active change affects Agent 2 output
        if 'heading' in request.data or 'body' in request.data or request.data.get('active'):
            _trigger_fingerprint_brand_kit(ws.id)
        return Response(_typography_data(t))

    def delete(self, request, pk):
        ws = get_workspace(request)
        if not require_admin(request.user, ws):
            return Response({'detail': 'Admins only.'}, status=403)
        try:
            ws.typography_presets.get(id=pk).delete()
        except TypographyPreset.DoesNotExist:
            return Response(status=404)
        return Response(status=204)


class ForbiddenKeywordView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        keywords = list(ws.disclaimer_keywords.values('id', 'keyword').order_by('keyword'))
        return Response(keywords)

    def post(self, request):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Editors only.'}, status=403)
        keyword = request.data.get('keyword', '').strip()
        if not keyword:
            return Response({'detail': 'Keyword required.'}, status=400)
        obj, created = DisclaimerKeyword.objects.get_or_create(workspace=ws, keyword__iexact=keyword, defaults={'keyword': keyword})
        if not created:
            return Response({'detail': 'Keyword already exists.'}, status=400)
        return Response({'id': obj.id, 'keyword': obj.keyword}, status=201)


class ForbiddenKeywordDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Editors only.'}, status=403)
        obj = ws.disclaimer_keywords.filter(pk=pk).first()
        if not obj:
            return Response(status=404)
        obj.delete()
        return Response(status=204)


# ─── Prompt Studio ────────────────────────────────────────────────────────────

def _safe_fal_upload(path):
    """Upload a file to fal.ai.
    - SVG files are converted to PNG first (fal.ai doesn't accept SVG).
    - Non-ASCII paths are copied to an ASCII temp path before upload.
    """
    import fal_client, os, tempfile, shutil
    ext = os.path.splitext(path)[1].lower()

    # SVG → PNG conversion
    if ext == '.svg':
        import cairosvg
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False, dir='/tmp') as tmp:
            tmp_path = tmp.name
        try:
            cairosvg.svg2png(url=path, write_to=tmp_path, output_width=512, output_height=512)
            return fal_client.upload_file(tmp_path)
        finally:
            os.unlink(tmp_path)

    # Non-ASCII path → copy to ASCII temp
    try:
        path.encode('ascii')
        return fal_client.upload_file(path)
    except (UnicodeEncodeError, UnicodeDecodeError):
        with tempfile.NamedTemporaryFile(suffix=ext or '.bin', delete=False, dir='/tmp') as tmp:
            tmp_path = tmp.name
        try:
            shutil.copy2(path, tmp_path)
            return fal_client.upload_file(tmp_path)
        finally:
            os.unlink(tmp_path)


def _get_creative_fal_url(creative):
    """Upload a GeneratedCreative image to fal.ai storage and return a public URL."""
    import io
    import os
    import tempfile
    import requests as http_req
    import fal_client

    # Prefer a local file (uploaded creatives have one; avoids a round-trip download)
    if creative.uploaded_file and creative.uploaded_file.name:
        return _safe_fal_upload(creative.uploaded_file.path)

    if not creative.image_url:
        return None

    # For generated creatives the URL is a fal.ai CDN or external URL — download then re-upload
    resp = http_req.get(creative.image_url, timeout=30)
    resp.raise_for_status()
    ct = resp.headers.get('content-type', '')
    if 'jpeg' in ct or 'jpg' in ct:
        ext = '.jpg'
    elif 'webp' in ct:
        ext = '.webp'
    else:
        ext = '.png'

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(resp.content)
        tmp_path = tmp.name
    try:
        return fal_client.upload_file(tmp_path)
    finally:
        os.unlink(tmp_path)


def _studio_gpt_size(ratio_str, resolution):
    """Map aspect ratio to fal.ai's accepted image_size literals for openai/gpt-image-2."""
    dims = {
        '1:1':  'square_hd',
        '4:5':  'portrait_4_3',
        '3:4':  'portrait_4_3',
        '9:16': 'portrait_16_9',
        '4:3':  'landscape_4_3',
        '5:4':  'landscape_4_3',
        '16:9': 'landscape_16_9',
    }
    return dims.get(ratio_str, 'square_hd')


def _studio_resize(image_url, target_ratio, resolution, output_format='png'):
    """Download image, smart-crop to target aspect ratio, resize, upload to fal.ai."""
    import io
    import os
    import tempfile
    import requests as http_requests
    import fal_client
    from PIL import Image as PILImage

    base = {'1K': 1024, '2K': 2048, '4K': 4096}.get(resolution, 1024)
    dims = {
        '1:1': (1, 1), '4:5': (4, 5), '5:4': (5, 4),
        '9:16': (9, 16), '16:9': (16, 9), '4:3': (4, 3), '3:4': (3, 4),
    }
    rw, rh = dims.get(target_ratio, (1, 1))
    target_float = rw / rh

    if rw >= rh:
        target_w, target_h = base, max(64, int(base * rh / rw))
    else:
        target_h, target_w = base, max(64, int(base * rw / rh))

    resp = http_requests.get(image_url, timeout=60)
    resp.raise_for_status()
    img = PILImage.open(io.BytesIO(resp.content)).convert('RGB')

    src_w, src_h = img.size
    src_float = src_w / src_h

    if abs(src_float - target_float) > 0.02:
        if src_float > target_float:
            new_w = int(src_h * target_float)
            left = (src_w - new_w) // 2
            img = img.crop((left, 0, left + new_w, src_h))
        else:
            new_h = int(src_w / target_float)
            top = (src_h - new_h) // 2
            img = img.crop((0, top, src_w, top + new_h))

    img = img.resize((target_w, target_h), PILImage.LANCZOS)

    fmt_map = {'png': 'PNG', 'jpeg': 'JPEG', 'jpg': 'JPEG', 'webp': 'WEBP'}
    fmt = fmt_map.get(output_format.lower(), 'PNG')
    ext_map = {'PNG': '.png', 'JPEG': '.jpg', 'WEBP': '.webp'}

    with tempfile.NamedTemporaryFile(suffix=ext_map.get(fmt, '.png'), delete=False) as tmp:
        img.save(tmp, format=fmt)
        tmp_path = tmp.name
    try:
        return fal_client.upload_file(tmp_path)
    finally:
        os.unlink(tmp_path)


def _run_studio_job(job_id, ws_id, user_id, params):
    """Background thread: run generation and write result to StudioJob row."""
    import os
    import threading
    import fal_client
    from django.conf import settings
    from django.db import connection
    from apps.creatives.models import GeneratedCreative, CreativeTag
    from apps.creatives.services import _build_creative_name
    from apps.accounts.models import Workspace, User
    from .models import StudioJob

    # Each background thread needs its own DB connection
    connection.close()

    try:
        os.environ['FAL_KEY'] = settings.FAL_KEY

        ws = Workspace.objects.get(id=ws_id)
        user = User.objects.get(id=user_id)

        model = params['model']
        user_prompt = params['user_prompt']
        aspect_ratios = params['aspect_ratios']
        resolution = params['resolution']
        output_format = params['output_format']
        reference_ids = params['reference_ids']
        character_id = params['character_id']
        environment_id = params['environment_id']
        logo_id = params['logo_id']
        cta_ids = params['cta_ids']
        promo_ids = params['promo_ids']
        disclaimer_id = params['disclaimer_id']
        palette_preset_id = params['palette_preset_id']
        typography_preset_id = params['typography_preset_id']

        disclaimer = None
        if disclaimer_id:
            disclaimer = ws.disclaimers.filter(id=disclaimer_id).first()
        if not disclaimer:
            disclaimer = ws.disclaimers.filter(is_default=True).first()

        palette = ws.palette_presets.filter(id=palette_preset_id).first() if palette_preset_id else None
        typography = ws.typography_presets.filter(id=typography_preset_id).first() if typography_preset_id else None

        def _upload(field_file):
            if field_file and field_file.name:
                return _safe_fal_upload(field_file.path)
            return None

        image_urls = []
        ref_count = 0
        char_index = env_index = logo_index = None
        cta_indices = []
        promo_indices = []

        if reference_ids:
            from apps.creatives.models import GeneratedCreative as _GC
            creatives_map = {str(c.id): c for c in _GC.objects.filter(workspace=ws, id__in=reference_ids)}
            for rid in reference_ids:
                c = creatives_map.get(str(rid))
                if c:
                    url = _get_creative_fal_url(c)
                    if url:
                        image_urls.append(url)
                        ref_count += 1

        if character_id:
            char = ws.characters.filter(id=character_id).prefetch_related('images').first()
            if char and char.images.exists():
                url = _upload(char.images.first().file)
                if url:
                    image_urls.append(url)
                    char_index = len(image_urls)

        if environment_id:
            env_static = ws.statics.filter(id=environment_id).first()
            if env_static:
                url = _upload(env_static.file)
                if url:
                    image_urls.append(url)
                    env_index = len(image_urls)

        if logo_id:
            logo_obj = ws.logos.filter(id=logo_id).first()
            if logo_obj:
                url = _upload(logo_obj.file)
                if url:
                    image_urls.append(url)
                    logo_index = len(image_urls)

        if cta_ids:
            ctas_map = {str(c.id): c for c in ws.ctas.filter(id__in=cta_ids)}
            for cid in cta_ids:
                c = ctas_map.get(str(cid))
                if c:
                    url = _upload(c.file)
                    if url:
                        image_urls.append(url)
                        cta_indices.append(len(image_urls))

        if promo_ids:
            promos_map = {str(p.id): p for p in ws.promos.filter(id__in=promo_ids)}
            for pid in promo_ids:
                p = promos_map.get(str(pid))
                if p:
                    url = _upload(p.file)
                    if url:
                        image_urls.append(url)
                        promo_indices.append(len(image_urls))

        if not image_urls:
            StudioJob.objects.filter(id=job_id).update(status='failed', error='No valid images found.')
            return

        parts = [
            "You are a professional creative advertising designer. "
            "Produce a high-quality advertising creative image following all instructions below precisely."
        ]
        if ref_count > 0:
            ref_nums = ', '.join(f'#Image{i + 1}' for i in range(ref_count))
            parts.append(
                f"PRIMARY REFERENCES ({ref_nums}): These are your main visual and style references. "
                "Base the overall look, mood, composition, and brand feel on them."
            )
        if char_index:
            parts.append(f"CHARACTER (#Image{char_index}): Incorporate this character naturally into the scene as described in the prompt.")
        if env_index:
            parts.append(f"BACKGROUND/ENVIRONMENT (#Image{env_index}): Use this as the background setting for the creative.")
        if logo_index:
            parts.append(
                f"LOGO (#Image{logo_index}): Place the logo in a natural, prominent position. "
                "Do NOT distort, warp, rotate, or modify the logo in any way — reproduce it exactly as provided."
            )
        if cta_indices:
            parts.append(f"CALL TO ACTION ({', '.join(f'#Image{i}' for i in cta_indices)}): Include these call-to-action elements in the design as described.")
        if promo_indices:
            parts.append(f"PROMOTIONAL VISUALS ({', '.join(f'#Image{i}' for i in promo_indices)}): Incorporate these promotional visuals in an appropriate location.")
        if palette and palette.colors:
            hex_values = [c['hex'] if isinstance(c, dict) else c for c in palette.colors]
            parts.append(f"BRAND COLOR PALETTE: Use these brand colors throughout: {', '.join(hex_values)}")
        if typography:
            parts.append(f"TYPOGRAPHY: Use {typography.heading} for headlines and {typography.body} for body text.")
        if disclaimer:
            parts.append(f'DISCLAIMER: Render this disclaimer text at the very bottom of the image in small print: "{disclaimer.text}"')

        system_prompt = '\n\n'.join(parts)
        primary_ratio = aspect_ratios[0]

        if model == 'gpt-image-2':
            combined = f"{system_prompt}\n\n{user_prompt}" if user_prompt else system_prompt
            result = fal_client.subscribe(
                "openai/gpt-image-2/edit",
                arguments={
                    "prompt": combined,
                    "image_urls": image_urls,
                    "image_size": _studio_gpt_size(primary_ratio, resolution),
                    "quality": "high",
                    "output_format": output_format,
                    "num_images": 1,
                },
            )
        else:
            result = fal_client.subscribe(
                "fal-ai/nano-banana-pro/edit",
                arguments={
                    "prompt": user_prompt or "Create a professional advertising creative.",
                    "image_urls": image_urls,
                    "system_prompt": system_prompt,
                    "output_format": output_format,
                    "resolution": resolution,
                    "aspect_ratio": primary_ratio,
                    "num_images": 1,
                },
            )

        primary_url = result['images'][0]['url']

        studio_tag, _ = CreativeTag.objects.get_or_create(
            workspace=ws,
            name='Studio',
            defaults={'color': '#8B5CF6', 'created_by': user},
        )

        from apps.creatives.models import GenerationJob
        model_label = 'GPT Image 2' if model == 'gpt-image-2' else 'Nano Banana Pro'
        gen_job = GenerationJob.objects.create(
            workspace=ws,
            created_by=user,
            generation_mode='prompt_studio',
            model_name=model_label,
            aspect_ratio=primary_ratio,
            resolution=resolution,
            output_format=output_format,
            extra_prompt=user_prompt,
            status='done',
            current_step='done',
        )
        if reference_ids:
            from apps.creatives.models import GeneratedCreative as _GC2
            refs = _GC2.objects.filter(workspace=ws, id__in=reference_ids)
            gen_job.reference_creatives.set(refs)

        def _save(img_url, ratio):
            name = _build_creative_name(ws, media_type='Photo', aspect_ratio=ratio)
            c = GeneratedCreative.objects.create(
                workspace=ws, created_by=user, name=name,
                image_url=img_url, aspect_ratio=ratio,
                source='troxa_generated', status='Ready',
                job=gen_job,
            )
            c.tags.add(studio_tag)
            return {'id': str(c.id), 'image_url': img_url, 'aspect_ratio': ratio, 'name': name}

        created = [_save(primary_url, primary_ratio)]

        adapt_prompt = (
            "Adapt this image to the new aspect ratio. "
            "Extend or recompose the background and surroundings as needed to fill the frame naturally. "
            "Keep the main subject, style, text, colors, and branding exactly as-is."
        )

        for ratio in aspect_ratios[1:]:
            try:
                if model == 'gpt-image-2':
                    adapt_result = fal_client.subscribe(
                        "openai/gpt-image-2/edit",
                        arguments={
                            "prompt": adapt_prompt,
                            "image_urls": [primary_url],
                            "image_size": _studio_gpt_size(ratio, resolution),
                            "quality": "high",
                            "output_format": output_format,
                            "num_images": 1,
                        },
                    )
                else:
                    adapt_result = fal_client.subscribe(
                        "fal-ai/nano-banana-pro/edit",
                        arguments={
                            "prompt": adapt_prompt,
                            "image_urls": [primary_url],
                            "output_format": output_format,
                            "resolution": resolution,
                            "aspect_ratio": ratio,
                            "num_images": 1,
                        },
                    )
                adapt_url = adapt_result['images'][0]['url']
                created.append(_save(adapt_url, ratio))
            except Exception as exc:
                logger.error('Studio adapt failed for ratio %s: %s', ratio, exc)

        StudioJob.objects.filter(id=job_id).update(status='done', result={'creatives': created})

    except Exception as exc:
        logger.error('PromptStudio job %s failed: %s', job_id, exc)
        StudioJob.objects.filter(id=job_id).update(status='failed', error=str(exc))
    finally:
        connection.close()


class PromptStudioGenerateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import threading
        from .models import StudioJob

        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Editors only.'}, status=403)

        def _get_list(key):
            val = request.data.get(key, [])
            return val if isinstance(val, list) else ([val] if val else [])

        aspect_ratios = _get_list('aspect_ratios')
        if not aspect_ratios:
            return Response({'error': 'At least one aspect ratio is required.'}, status=400)

        job = StudioJob.objects.create(workspace=ws, created_by=request.user)

        params = {
            'model': request.data.get('model', 'nano-banana'),
            'user_prompt': request.data.get('prompt', '').strip(),
            'aspect_ratios': aspect_ratios,
            'resolution': request.data.get('resolution', '1K'),
            'output_format': request.data.get('output_format', 'png'),
            'reference_ids': _get_list('reference_ids'),
            'character_id': request.data.get('character_id'),
            'environment_id': request.data.get('environment_id'),
            'logo_id': request.data.get('logo_id'),
            'cta_ids': _get_list('cta_ids'),
            'promo_ids': _get_list('promo_ids'),
            'disclaimer_id': request.data.get('disclaimer_id'),
            'palette_preset_id': request.data.get('palette_preset_id'),
            'typography_preset_id': request.data.get('typography_preset_id'),
        }

        t = threading.Thread(target=_run_studio_job, args=(job.id, ws.id, request.user.id, params), daemon=True)
        t.start()

        return Response({'job_id': str(job.id)}, status=202)


class PromptStudioStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, job_id):
        from .models import StudioJob
        ws = get_workspace(request)
        try:
            job = StudioJob.objects.get(id=job_id, workspace=ws)
        except StudioJob.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)

        if job.status == 'done':
            return Response({'status': 'done', 'creatives': job.result.get('creatives', [])})
        if job.status == 'failed':
            return Response({'status': 'failed', 'error': job.error})
        return Response({'status': 'pending'})
