"""
Core AI generation services. All functions run in daemon threads.
"""
import io
import os
import re
import json
import logging
import threading
import traceback
import requests

import fal_client

logger = logging.getLogger(__name__)

from django.conf import settings
from django.utils import timezone

from .models import GenerationJob, GeneratedCreative, VideoJob, LogoJob, LogoJobImage
from apps.billing.models import Subscription, CreditTransaction
from apps.activity.utils import log_event


# ─── Creative naming ─────────────────────────────────────────────────────────

def _derive_workspace_code(name):
    words = name.strip().split()
    if len(words) == 1:
        code = name[:2].upper()
    else:
        code = ''.join(w[0] for w in words if w)[:4].upper()
    return code or 'XX'


def _format_ratio_code(ratio_str):
    if ratio_str and ':' in ratio_str:
        return ratio_str.replace(':', 'x')
    return '1x1'


_STANDARD_ASPECT_RATIOS = [
    ('1:1', 1 / 1), ('4:5', 4 / 5), ('5:4', 5 / 4), ('9:16', 9 / 16), ('16:9', 16 / 9),
    ('4:3', 4 / 3), ('3:4', 3 / 4), ('3:2', 3 / 2), ('2:3', 2 / 3),
]


def aspect_ratio_label_from_size(width, height):
    """Map real pixel dimensions to the closest standard ad-format ratio label
    (the same small set users pick from at generation time), so uploaded/
    edited creatives display a ratio that matches how they actually look
    instead of a hardcoded/stale default. Falls back to a reduced fraction
    for anything too far from a standard ratio to label sensibly."""
    if not width or not height:
        return '1:1'
    ratio = width / height
    label, rel_diff = min(
        ((l, abs(ratio - r) / r) for l, r in _STANDARD_ASPECT_RATIOS),
        key=lambda pair: pair[1],
    )
    if rel_diff <= 0.04:
        return label
    from fractions import Fraction
    frac = Fraction(width, height).limit_denominator(20)
    return f'{frac.numerator}:{frac.denominator}'


def _build_creative_name(workspace, media_type='Photo', aspect_ratio=None):
    from django.db.models import F
    from apps.accounts.models import Workspace as _WS
    code = workspace.code or _derive_workspace_code(workspace.name)
    type_code = 'V' if media_type == 'Video' else 'S'
    ratio_code = _format_ratio_code(aspect_ratio or '1:1')
    _WS.objects.filter(pk=workspace.pk).update(creative_counter=F('creative_counter') + 1)
    workspace.refresh_from_db(fields=['creative_counter'])
    seq = f'{workspace.creative_counter:04d}'
    return f'TROXA_{code}_{type_code}_{seq}_{ratio_code}'


# ─── Captioning ───────────────────────────────────────────────────────────────
# Captioning is lazy: a creative is only captioned the moment it's actually
# picked as a reference photo for a new generation (see `ensure_caption`
# below), not immediately when it's generated/uploaded/edited. This mirrors
# the captioning that used to run only for brand_kit's WinningStatic uploads,
# just deferred until the caption is actually needed.

def _analysis_to_caption(analysis: dict) -> str:
    """Convert an ImageAnalysisRecord.analysis JSON into a rich caption string.
    Uses the Sonnet-generated fields directly — much richer than Florence."""
    parts = []
    if analysis.get('recreate_prompt'):
        parts.append(analysis['recreate_prompt'])
    if analysis.get('subject'):
        parts.append(f"Subject: {analysis['subject']}")
    if analysis.get('art_style'):
        parts.append(f"Style: {analysis['art_style']}")
    if analysis.get('composition'):
        parts.append(f"Composition: {analysis['composition']}")
    if analysis.get('color_profile'):
        parts.append(f"Colors: {analysis['color_profile']}")
    branding = analysis.get('branding_elements') or {}
    if branding.get('cta_text'):
        parts.append(f"CTA: {branding['cta_text']}")
    if branding.get('brand_name'):
        parts.append(f"Brand: {branding['brand_name']}")
    typo = analysis.get('typography_in_image') or {}
    if typo.get('main_headline'):
        parts.append(f"Headline: {typo['main_headline']}")
    return '\n'.join(parts)


def _get_sonnet_caption(creative) -> str:
    """Try to find an existing Sonnet analysis for this creative in the
    fingerprint corpus. Returns '' if none exists."""
    try:
        from apps.fingerprint.models import ImageAnalysisRecord
        record = ImageAnalysisRecord.objects.filter(
            workspace_id=creative.workspace_id,
            creative_id=str(creative.id),
        ).exclude(analysis={}).first()
        if record and record.analysis:
            return _analysis_to_caption(record.analysis)
    except Exception:
        pass
    return ''


def _run_caption(creative_id):
    """Blocking — fetches and saves a Florence caption for one creative.
    Only called as a fallback when no Sonnet analysis exists."""
    try:
        creative = GeneratedCreative.objects.get(id=creative_id)
        creative.caption_status = 'processing'
        creative.save(update_fields=['caption_status'])

        os.environ['FAL_KEY'] = settings.FAL_KEY
        result = fal_client.subscribe(
            'fal-ai/florence-2-large/more-detailed-caption',
            arguments={'image_url': creative.image_url},
        )
        caption_text = result.get('results', '') if isinstance(result, dict) else str(result)
        creative.caption = caption_text
        creative.caption_status = 'done' if caption_text else 'error'
        creative.save(update_fields=['caption', 'caption_status'])
        return caption_text
    except Exception:
        GeneratedCreative.objects.filter(id=creative_id).update(caption_status='error')
        return ''


def ensure_caption(creative):
    """Returns this creative's caption for use as a reference.
    Priority: 1) already-stored caption  2) Sonnet fingerprint analysis  3) Florence fallback."""
    if creative.caption:
        return creative.caption
    # Prefer rich Sonnet analysis from fingerprint corpus (no API call needed)
    sonnet = _get_sonnet_caption(creative)
    if sonnet:
        return sonnet
    # Fall back to Florence only when no Sonnet data exists
    return _run_caption(creative.id)


# ─── Model routing ───────────────────────────────────────────────────────────

MODEL_MAP = {
    'Nano Banana 2':       'fal-ai/nano-banana-2',
    'Nano Banana Pro':     'fal-ai/nano-banana-pro',
    'GPT Image 2':         'openai/gpt-image-2',
    'Grok Imagine':        'xai/grok-imagine-image',
    'Seedream 5.0 Pro':    'bytedance/seedream/v5/pro/text-to-image',
    'Ideogram v4':         'ideogram/v4',
    'Qwen Image 2 Pro':    'fal-ai/qwen-image-2/pro/text-to-image',
}

ASPECT_TO_SIZE = {
    '1:1': 'square_hd',
    '16:9': 'landscape_16_9',
    '9:16': 'portrait_16_9',
    '4:5': 'portrait_4_5',
    '4:3': 'landscape_4_3',
    '3:2': 'landscape_3_2',
}

# GPT Image 2 via OpenAI only supports these three native pixel sizes.
# fal.ai named presets (portrait_16_9 etc.) are silently ignored for this model.
GPT_IMAGE_2_SIZES = {
    '1:1':  {'width': 1024, 'height': 1024},
    '16:9': {'width': 1792, 'height': 1024},  # native 16:9 ≈ 1.75:1
    '9:16': {'width': 1024, 'height': 1792},  # native 9:16 ≈ 0.571
    '4:5':  {'width': 1024, 'height': 1280},  # closest to 4:5 via crop target
    '4:3':  {'width': 1365, 'height': 1024},  # 4:3 exact approximation
    '3:2':  {'width': 1536, 'height': 1024},  # exact 3:2
    '2:3':  {'width': 1024, 'height': 1536},  # exact 2:3
    '3:4':  {'width': 1024, 'height': 1365},  # 3:4 approximation
}

# Custom pixel sizes for models that accept {width, height} image_size dicts.
# Seedream min area: 1024x1024 = 1,048,576 px; max 2048x2048.
# Qwen min area: 512x512; max 2048x2048.
# Keyed as (aspect_ratio, resolution_tier).
CUSTOM_IMAGE_SIZES = {
    ('1:1',  '1K'): {'width': 1024, 'height': 1024},
    ('1:1',  '2K'): {'width': 1536, 'height': 1536},
    ('1:1',  '4K'): {'width': 2048, 'height': 2048},
    ('16:9', '1K'): {'width': 1440, 'height': 810},
    ('16:9', '2K'): {'width': 1792, 'height': 1008},
    ('16:9', '4K'): {'width': 2048, 'height': 1152},
    ('9:16', '1K'): {'width': 810,  'height': 1440},
    ('9:16', '2K'): {'width': 1008, 'height': 1792},
    ('9:16', '4K'): {'width': 1152, 'height': 2048},
    ('4:5',  '1K'): {'width': 1024, 'height': 1280},
    ('4:5',  '2K'): {'width': 1280, 'height': 1600},
    ('4:5',  '4K'): {'width': 1638, 'height': 2048},
    ('4:3',  '1K'): {'width': 1184, 'height': 888},
    ('4:3',  '2K'): {'width': 1536, 'height': 1152},
    ('4:3',  '4K'): {'width': 2048, 'height': 1536},
    ('3:2',  '1K'): {'width': 1260, 'height': 840},
    ('3:2',  '2K'): {'width': 1536, 'height': 1024},
    ('3:2',  '4K'): {'width': 2048, 'height': 1366},
}

# Ideogram rendering speed mapped from resolution tier
IDEOGRAM_SPEED = {
    '1K': 'TURBO',
    '2K': 'BALANCED',
    '4K': 'QUALITY',
}

STYLE_RULES = {
    'realistic': 'VISUAL STYLE NOTE: photorealistic, cinematic lighting, real textures. Preserve all CTAs and text exactly.',
    'cartoon': 'VISUAL STYLE NOTE: cartoon/vector illustration style, bold outlines, vibrant flat colors. Preserve all CTAs and text exactly.',
    'textbased': 'VISUAL STYLE NOTE: typography-first design, bold text hierarchy, high contrast, clean geometric shapes. Preserve all CTAs and text exactly.',
}


# ─── Main generation entry point ─────────────────────────────────────────────

def generate_job_async(job_id):
    t = threading.Thread(target=_generate_worker, args=(job_id,), daemon=True)
    t.start()


def _generate_worker(job_id):
    from django.db import close_old_connections, connection

    # Each thread needs its own fresh DB connection (SQLite can't share across threads)
    close_old_connections()

    try:
        job = GenerationJob.objects.select_related('workspace', 'created_by', 'campaign', 'disclaimer').get(pk=job_id)
    except GenerationJob.DoesNotExist:
        return

    os.environ['FAL_KEY'] = settings.FAL_KEY

    try:
        _set_step(job, 'processing', 'captioning')

        # 1. Collect captions — reference statics always drive design
        statics_list = list(job.reference_creatives.all())
        captions = [ensure_caption(s) for s in statics_list]
        captions = [c for c in captions if c]

        # Character captions collected separately (used as appearance reference, not design basis)
        character_captions = []
        if job.character_id:
            char_images = list(job.character.images.filter(caption_status='done').exclude(caption=''))
            character_captions = [img.caption for img in char_images]
            # If no design statics were provided, fall back to character images as basis
            if not captions:
                captions = character_captions
        workspace_id = job.workspace_id
        created_by_id = job.created_by_id
        campaign_name = job.campaign.name if job.campaign else 'Creative'

        # Load fingerprint DNA once — used by both prompt-building paths below
        fingerprint_dna = None
        if job.use_fingerprint:
            fingerprint_dna = _load_fingerprint_dna(workspace_id)

        # 2. Generate master prompt — close DB before long external API calls
        _set_step(job, 'processing', 'generating_prompt')
        connection.close()  # release lock during long fal_client call

        if job.master_prompt:
            # Pre-built by Prompt Architect — skip all prompt construction steps.
            # The master_prompt is already stored on the job; proceed directly to rendering.
            logger.info("generation.prebuilt_prompt job_id=%s len=%d", job.id, len(job.master_prompt))
        elif captions:
            prompt_data = _generate_master_prompt(job, captions, character_captions=character_captions, fingerprint_dna=fingerprint_dna)
            job.master_prompt = prompt_data.get('master_prompt', '')
            job.vibe_and_atmosphere = prompt_data.get('vibe_and_atmosphere', '')
            job.recommended_colors = prompt_data.get('recommended_colors', [])
            job.character_archetype = prompt_data.get('character_archetype')
            job.save(update_fields=['master_prompt', 'vibe_and_atmosphere', 'recommended_colors', 'character_archetype'])
        else:
            _build_autonomous_betting_prompt(job, fingerprint_dna=fingerprint_dna)

        # 3. Generate images — close DB before long fal_client call
        _set_step(job, 'processing', 'generating_images')
        connection.close()  # release lock during image generation

        image_urls = _run_image_model(job)

        # 4. Save creatives
        _set_step(job, 'processing', 'saving')
        created_count = 0
        saved_creative_ids = []
        for i, url in enumerate(image_urls):
            creative_name = _build_creative_name(job.workspace, media_type='Photo', aspect_ratio=job.aspect_ratio)
            c = GeneratedCreative.objects.create(
                workspace=job.workspace,
                job=job,
                campaign=job.campaign,
                name=creative_name,
                image_url=url,
                thumbnail_url=url,
                aspect_ratio=job.aspect_ratio,
                created_by=job.created_by,
            )
            saved_creative_ids.append(str(c.id))
            created_count += 1

        # 5. Deduct credits — cost varies by model
        MODEL_CREDIT_COST = {
            'Nano Banana Pro':  2,
            'GPT Image 2':      2,
            'Seedream 5.0 Pro': 2,
        }
        cost_per_img = MODEL_CREDIT_COST.get(job.model_name, 1)
        total_credits = created_count * cost_per_img
        _deduct_credits(job.workspace, total_credits, f'Generated {created_count} creatives ({job.model_name})')
        log_event(job.workspace, job.created_by, 'generation', f'{created_count} creatives generated')

        job.status = 'done'
        job.current_step = 'done'
        job.save(update_fields=['status', 'current_step'])

        # Quality evaluation — create pending records immediately, evaluate async
        from .models import CreativeQualityScore
        for cid in saved_creative_ids:
            try:
                c = GeneratedCreative.objects.get(id=cid)
                CreativeQualityScore.objects.get_or_create(creative=c)
                evaluate_creative_async(cid)
            except Exception:
                pass

        # Auto logo placement (fire-and-forget)
        if job.logo_id:
            try:
                _auto_place_logo_on_job(job)
            except Exception:
                pass

        # Drive auto-sync (fire-and-forget)
        try:
            from apps.drive_integration.services import auto_sync_generation
            auto_sync_generation(job.workspace, job, image_urls, creative_ids=saved_creative_ids)
        except Exception:
            pass

    except Exception as e:
        logger.error('Generation worker failed for job %s:\n%s', job_id, traceback.format_exc())
        job.status = 'error'
        job.current_step = 'error'
        job.error_message = str(e)[:500]
        job.save(update_fields=['status', 'current_step', 'error_message'])


def _set_step(job, status, step):
    job.status = status
    job.current_step = step
    job.save(update_fields=['status', 'current_step'])


def _load_promo_texts(workspace_id) -> list:
    """Return list of verbatim promo strings extracted from Brand Kit promo images.

    Each entry is the full extracted_text for one promo image, e.g.
    "CASH OUT | You are in Control | CASH OUT" or "CASHBACK | Up to 5% of your losses".
    The caller is responsible for parsing headline vs. secondary text from the | separator.
    """
    try:
        from apps.brand_kit.models import Promo
        texts = list(
            Promo.objects
            .filter(workspace_id=workspace_id, extraction_status='done')
            .exclude(extracted_text='')
            .order_by('-uploaded_at')
            .values_list('extracted_text', flat=True)[:10]
        )
        return [t.strip() for t in texts if t.strip()]
    except Exception:
        return []


def _load_fingerprint_dna(workspace_id) -> dict | None:
    """
    Load visual_dna + brand_profile from BrandFingerprint for a workspace.
    Returns a flat dict ready to be injected into prompts, or None if unavailable.
    Never raises.
    """
    try:
        from apps.fingerprint.models import BrandFingerprint
        fp = BrandFingerprint.objects.filter(workspace_id=workspace_id).first()
        if not fp or not fp.visual_dna:
            return None
        vdna = fp.visual_dna or {}
        neg = fp.negative_patterns or {}
        bp = fp.brand_profile or {}
        color_names = ', '.join(
            c.get('name', c.get('hex', '')) for c in vdna.get('dominant_color_tendencies', []) if c
        ) or 'not specified'
        return {
            'summary': vdna.get('summary_style_dna', ''),
            'art_style': vdna.get('recurring_art_style', ''),
            'composition': vdna.get('recurring_composition_patterns', ''),
            'lighting': vdna.get('recurring_lighting_mood', ''),
            'background': vdna.get('recurring_background_style', ''),
            'typography': vdna.get('typography_tendencies', ''),
            'color_names': color_names,
            'color_list': vdna.get('dominant_color_tendencies', []),
            'style_tags': vdna.get('style_tags_ranked', []),
            'avoid_summary': neg.get('summary_negative_dna', ''),
            'avoid_tags': neg.get('avoid_style_tags', []),
            'brand_tone': bp.get('brand_tone_keywords', []),
            'promo_themes': _load_promo_texts(workspace_id),
            'confidence': fp.confidence,
        }
    except Exception as exc:
        logger.warning('fingerprint._load_fingerprint_dna failed workspace_id=%s: %s', workspace_id, exc)
        return None


def _generate_master_prompt(job, captions, character_captions=None, fingerprint_dna=None):
    if job.disclaimer:
        disclaimer_text = job.disclaimer.text
    else:
        default_d = job.workspace.disclaimers.filter(is_default=True).first()
        disclaimer_text = default_d.text if default_d else '18+. No Purchase Necessary. Void Where Prohibited. Terms and Conditions Apply'

    style_map = {
        'realistic': (
            'VISUAL STYLE NOTE: Render the scene in a photorealistic style — cinematic lighting, real textures, natural depth of field. '
            'Do NOT use any cartoon, illustration, or animated elements. Characters and objects must look photographic. '
            'Keep all CTAs, promotional text, game titles, and other textual content from the reference analyses intact. '
        ),
        'cartoon': (
            'VISUAL STYLE NOTE: Render the scene as a cartoon or vector illustration — bold outlines, vibrant flat colors, exaggerated animated aesthetic. '
            'Keep all CTAs, promotional text, game titles, and other textual content from the reference analyses intact. '
        ),
        'textbased': (
            'VISUAL STYLE NOTE: Use a graphic design / typography-first approach. '
            'Bold text and visual hierarchy are the centerpiece. Clean shapes, high contrast backgrounds, minimal photography. '
            'Keep all CTAs, promotional text, and game titles from the reference analyses prominent and intact. '
        ),
    }
    style_rule = style_map.get(job.style, '') if job.style else ''

    from apps.brand_kit.models import DisclaimerKeyword
    blacklist = list(
        DisclaimerKeyword.objects.filter(workspace=job.workspace).values_list('keyword', flat=True)
    )

    blacklist_rule = ''
    if blacklist:
        terms = ', '.join(f'"{k}"' for k in blacklist)
        blacklist_rule = (
            f'6. KEYWORD BLACKLIST — ABSOLUTE PROHIBITION: The following words/phrases must NEVER appear '
            f'anywhere in the output — not in any text, CTAs, body copy, or the master_prompt itself: {terms}. '
            'Treat these as completely banned vocabulary. Do not use, paraphrase, or allude to them in any form. '
        )

    # Character instruction for system prompt
    character_context = ''
    character_name_for_block = ''
    if job.character_id:
        char = job.character
        character_name_for_block = char.name
        character_context = (
            'CHARACTER NOTE: The user message ends with a "CHARACTER" section. '
            'The ad design — objects, decorations, slot machines, coins, typography, layout, colors, promotional text, CTA — all come from the advertisement analyses and must remain fully detailed. '
            'The character section only tells you the appearance of the central person; it does not change any other design element. '
            'Ignore any background or scene details in the character description. '
            f'Do NOT render the text "{char.name}" or any variation as visible text in the image. '
        )

    char_rule = ''
    char_json_field = ''
    if job.generate_new_character:
        char_rule = (
            '6. GENERATE NEW CHARACTER: Create a completely original fictional character for this advertisement. '
            'You may draw stylistic inspiration from the reference images (mood, setting, color palette, fashion style) '
            'but the character MUST be wholly invented — a new person who does NOT resemble the people in the reference photos. '
            'Give them a unique fictional name, an archetype (e.g. The Visionary, The Rebel, The Sage), '
            'and a detailed visual description that the image model can use directly. '
            'Weave this character naturally into the master_prompt as the main subject. '
        )
        char_json_field = (
            '"character_archetype": {'
            '"name": "Fictional character name", '
            '"archetype": "Archetype label", '
            '"description": "Detailed visual description for image generation", '
            '"visual_traits": ["trait1", "trait2"]'
            '}, '
        )
        if blacklist_rule:
            char_rule = char_rule.replace('6.', '7.')

    combined_analyses = '\n\n'.join(
        [f'Analysis {i+1}:\n{c}' for i, c in enumerate(captions)]
    )

    # Brand fingerprint block — injected when use_fingerprint=True and DNA is available.
    # Phrasing scales with job.blend_weight (0=pure references, 100=pure fingerprint).
    fingerprint_block = ''
    blend_weight = getattr(job, 'blend_weight', 50)
    if fingerprint_dna:
        tags_str = ', '.join(fingerprint_dna['style_tags'][:6]) if fingerprint_dna['style_tags'] else 'not specified'
        tone_str = ', '.join(fingerprint_dna['brand_tone'][:5]) if fingerprint_dna['brand_tone'] else 'not specified'
        avoid_str = fingerprint_dna['avoid_summary'] or 'none noted'
        dna_facts = (
            f'Style essence: {fingerprint_dna["summary"]} '
            f'Art style: {fingerprint_dna["art_style"]}. '
            f'Composition: {fingerprint_dna["composition"]}. '
            f'Lighting/mood: {fingerprint_dna["lighting"]}. '
            f'Background: {fingerprint_dna["background"]}. '
            f'Color palette: {fingerprint_dna["color_names"]}. '
            f'Typography: {fingerprint_dna["typography"]}. '
            f'Style tags: {tags_str}. '
            f'Brand tone: {tone_str}. '
            f'Avoid: {avoid_str}. '
        )
        if blend_weight <= 20:
            # Pure references — fingerprint is just a whisper
            fingerprint_block = (
                'BRAND CONTEXT (background only — do NOT let it override the reference style): '
                + dna_facts
            )
        elif blend_weight <= 45:
            # References dominant
            fingerprint_block = (
                'REFERENCE-LED BLEND: The visual analyses below are your PRIMARY design guide. '
                'Extract composition, palette, typography, and mood directly from the references. '
                'The brand fingerprint below provides light tonal consistency only — it must NOT override the reference style. '
                'BRAND FINGERPRINT (accent only): ' + dna_facts
            )
        elif blend_weight <= 65:
            # Balanced
            fingerprint_block = (
                'BALANCED BLEND: Synthesize the reference analyses AND the brand fingerprint with equal weight. '
                'References inform content and style; the fingerprint ensures brand consistency. '
                'BRAND VISUAL DNA: ' + dna_facts
                + 'Propose a direction that honours both the references and the DNA. '
            )
        elif blend_weight <= 85:
            # Fingerprint dominant
            fingerprint_block = (
                'BRAND DNA-LED BLEND: The fingerprint is your primary compass. '
                'Use the references as loose thematic inspiration — extract context and messaging, but do NOT copy their visual style. '
                'BRAND VISUAL DNA: ' + dna_facts
                + 'Your task is a FRESH creative direction that stays unmistakably on-brand while drawing loose themes from the references. '
            )
        else:
            # Pure fingerprint
            fingerprint_block = (
                'BRAND FINGERPRINT ONLY: The brand DNA is your exclusive creative guide. '
                'The reference analyses may suggest thematic context, but must NOT influence visual style or composition. '
                'BRAND VISUAL DNA — treat this as absolute law: ' + dna_facts
                + 'Do NOT copy or recombine any reference visuals. Propose something genuinely new and unmistakably on-brand. '
            )

    system_instruction = (
        f'You are an expert prompt engineer. I will provide you with visual analyses of {len(captions)} different advertisement images. '
        f'Your task is to synthesize these analyses and create a Master Prompt for the image generation model. '
        + fingerprint_block +
        'CRITICAL RULES: '
        '1. ABSOLUTELY NO LOGOS: Instruct the model explicitly NOT to generate any logos, emblems, watermarks, or brand marks inside the image. '
        '2. OUTPUT FORMAT: You MUST return ONLY a valid JSON object. Do NOT include markdown blocks, introductions, or explanations. '
        f'3. FIXED DISCLAIMER: The creative MUST include this exact disclaimer text, rendered small at the very bottom of the image: '
        f'"{disclaimer_text}". '
        'Do NOT use any disclaimer text seen in the reference images — use only this fixed disclaimer. '
        '4. DON\'T USE ANY MONEY SIGN ($,€,TL).'
        '5. Cohesive text size and fonts across all generated statics. Font types should fit with the style and design of the creatives.'
        + (_simplicity_note(job.simplicity_weight) if job.simplicity_weight is not None else '')
        + character_context + style_rule + blacklist_rule + char_rule +
        'Your JSON output must strictly follow this structure: '
        '{' + char_json_field +
        '"master_prompt": "The highly detailed English prompt...", '
        '"vibe_and_atmosphere": "Short description of the overall mood", '
        '"recommended_colors": ["color1", "color2", "color3"]}'
    )

    # Build user message
    if character_captions and character_name_for_block:
        char_lines = ' '.join(character_captions)
        char = job.character
        char_desc_line = f'\nAdditional notes about this character: {char.description.strip()}' if char.description and char.description.strip() else ''
        extra_line = ''
        if job.extra_prompt and job.extra_prompt.strip():
            clean_extra = re.sub(r'@\[([^\]]+)\]', r'\1', job.extra_prompt.strip())
            extra_line = f'\n\n--- EXTRA INSTRUCTIONS ---\n{clean_extra}'
        user_message = (
            f'Here are the visual analyses to synthesize:\n\n'
            f'{combined_analyses}\n\n'
            f'--- CHARACTER: {character_name_for_block} ---\n'
            f'Replace the central person in the creative with this character. '
            f'If the extra instructions reference "{character_name_for_block}", they are referring to this character. '
            f'Extract only physical appearance from the raw caption below (ignore backgrounds/scenes):\n'
            f'{char_lines}'
            f'{char_desc_line}'
            f'{extra_line}'
        )
    else:
        extra_line = ''
        if job.extra_prompt and job.extra_prompt.strip():
            clean_extra = re.sub(r'@\[([^\]]+)\]', r'\1', job.extra_prompt.strip())
            extra_line = f'\n\n--- EXTRA INSTRUCTIONS ---\n{clean_extra}'
        user_message = f'Here are the visual analyses to synthesize:\n\n{combined_analyses}{extra_line}'

    try:
        result = fal_client.subscribe(
            'openrouter/router',
            arguments={
                'model': 'openai/gpt-4.1',
                'system_prompt': system_instruction,
                'prompt': user_message,
                'temperature': 1.0 if fingerprint_dna else 0.2,
            },
        )
        raw = result.get('output', '') if isinstance(result, dict) else str(result)
        clean = raw.strip()
        if clean.startswith('```'):
            clean = clean.split('\n', 1)[1]
            clean = clean.rsplit('```', 1)[0]
        parsed = json.loads(clean)
        return parsed
    except Exception:
        pass

    fallback = re.sub(r'@\[([^\]]+)\]', r'\1', job.extra_prompt) if job.extra_prompt else 'A vibrant iGaming advertisement'
    return {'master_prompt': fallback, 'vibe_and_atmosphere': '', 'recommended_colors': [], 'character_archetype': None}


# ---------------------------------------------------------------------------
# Theme concept bank — prevents theme lock when all DNA is applied at once.
# Each entry is a complete creative seed ready to drop into a prompt.
# The model picks one randomly per generation, keeping brand art style/colors
# but exploring different subjects, scenes, and hero elements every time.
# ---------------------------------------------------------------------------
_BANNED_VISUAL_TROPES = (
    'No generic iGaming clichés: no dragons, no treasure chests, no crowns, no castles, '
    'no aurora borealis palaces, no wizards, no pharaohs, no Vikings, no crystal pillars, '
    'no coin avalanches, no slot machine reels as background decoration. '
)


def _derive_visual_concept(promo_text: str, fingerprint_dna: dict | None) -> str:
    """Call Claude Sonnet to derive a visual concept semantically tied to the promo text.

    The concept must relate to what the promo means emotionally/conceptually —
    not reuse generic fantasy tropes.  Falls back to keyword-based heuristics
    if the API call fails.
    """
    system = (
        'You are a creative director specialising in iGaming advertising.\n'
        'Given a promotional offer text, generate ONE specific visual concept for a static ad image.\n\n'
        'Rules:\n'
        '- The concept must directly reflect the emotional meaning or benefit of the promo\n'
        '- BANNED visual elements: dragons, castles, treasure chests, crowns, crystal pillars, '
        'aurora borealis, wizards, Vikings, pharaohs, samurai, wolves, slot machine reels as hero\n'
        '- Be specific: name the key visual element, its action/state, and the mood it creates\n'
        '- 1–2 sentences only\n'
        '- Output ONLY the concept description — no preamble, no quotes, no labels'
    )
    brand_tone = ', '.join((fingerprint_dna or {}).get('brand_tone', [])[:3]) or 'premium, trustworthy'
    user_msg = f'Promo: {promo_text}\nBrand tone: {brand_tone}'

    try:
        result = fal_client.subscribe(
            'openrouter/router/enterprise',
            arguments={
                'system_prompt': system,
                'prompt': user_msg,
                'model': 'anthropic/claude-sonnet-5',
                'temperature': 0.85,
            },
        )
        concept = (result.get('output') or '').strip()
        if concept and len(concept) > 10:
            logger.info('theme_agent.concept: %s', concept[:120])
            return concept
    except Exception as exc:
        logger.warning('theme_agent.failed: %s', exc)

    # Keyword fallback — keeps things running even if the agent is down
    p = promo_text.lower()
    if 'cashback' in p:
        return (
            'A confident hand catching glowing coins returning toward the viewer against a dark, '
            'sleek background — the mood is relief and satisfaction, money coming back home.'
        )
    if 'boost' in p:
        return (
            'A sharp upward arrow breaking through a luminous scoreboard, with energy lines '
            'radiating outward — the mood is momentum, acceleration, amplified returns.'
        )
    if 'control' in p or 'cash out' in p:
        return (
            'A hand firmly pressing a bright, illuminated green button on a sleek modern interface '
            '— the mood is empowerment and decisive action.'
        )
    if 'sign up' in p or 'claim' in p:
        return (
            'A glowing reward package bursting open with golden light, set against a deep dark '
            'background — the mood is excitement and anticipation of receiving something valuable.'
        )
    if 'deposit' in p:
        return (
            'Clean, modern visualization of digital coins being deposited and instantly multiplied '
            'on a sleek neon-lit interface — the mood is trust and growth.'
        )
    if 'free' in p or 'bonus' in p:
        return (
            'A moment of pure surprise: an unexpected gift materialising from light — minimal '
            'composition, strong contrast, the bonus as the sole hero of the frame.'
        )
    return (
        'A sleek, modern iGaming advertisement with strong typographic hierarchy, '
        'brand colors dominating the frame, and a single powerful focal point that '
        'commands attention without visual clutter.'
    )


def _build_autonomous_betting_prompt(job, fingerprint_dna=None):
    """Build a betting-ad prompt without any reference images.
    When fingerprint_dna is provided (use_fingerprint=True), builds from the
    brand's visual DNA instead of the generic iGaming template.
    """
    style_hints = {
        'realistic': 'Photorealistic style — cinematic lighting, real textures, natural depth of field. ',
        'cartoon': 'Cartoon/vector illustration style — bold outlines, vibrant flat colors, animated aesthetic. ',
        'character': 'Feature a dynamic fictional sports/casino character as the main visual subject. ',
        'text-only': 'Typography-first design — bold text hierarchy, high contrast, minimal photography. ',
        'map': 'Incorporate sports or geographic map elements as decorative background. ',
    }
    style_hint = style_hints.get(job.style or '', '')
    if job.disclaimer:
        disclaimer_text = job.disclaimer.text
    else:
        default_d = job.workspace.disclaimers.filter(is_default=True).first()
        disclaimer_text = default_d.text if default_d else '18+. No Purchase Necessary. Void Where Prohibited. Terms and Conditions Apply'

    blacklist = list(
        job.workspace.disclaimer_keywords.values_list('keyword', flat=True)
    )
    blacklist_note = ''
    if blacklist:
        terms = ', '.join(f'"{k}"' for k in blacklist)
        blacklist_note = f'NEVER use these words anywhere in the image: {terms}. '

    if fingerprint_dna:
        import random as _random
        # -----------------------------------------------------------
        # Brand-aware autonomous prompt.
        #
        # Strategy:
        #   1. Pick ONE real promo from brand kit (promo drives everything).
        #   2. Derive a visual concept from that promo via Claude Sonnet —
        #      semantically connected, no generic fantasy tropes.
        #   3. Keep brand INVARIANT elements (art style + colors) on every
        #      generation.
        #   4. Randomly pick 2 of 4 "variable" DNA fields so each generation
        #      feels structurally fresh.
        # -----------------------------------------------------------

        # 1. Headline + promo: ONLY from brand kit extracted promo texts ─────────
        # Pick ONE real promo from brand kit — both headline and promo line must
        # reference it. NEVER invent bonus amounts, percentages, or coin values.
        # Done FIRST so the visual concept agent can use the promo text.
        _bk_promos = fingerprint_dna.get('promo_themes') or []
        if _bk_promos:
            promo_pick = _random.choice(_bk_promos)

            # Parse the full promo string into headline text + secondary detail.
            # e.g. "CASH OUT | You are in Control | CASH OUT"
            #   → headline_text = "CASH OUT"
            #   → secondary_text = "You are in Control"  (first non-duplicate segment)
            # e.g. "CASHBACK | Up to 5% of your losses"
            #   → headline_text = "CASHBACK"
            #   → secondary_text = "Up to 5% of your losses"
            _promo_parts = [p.strip() for p in promo_pick.split('|') if p.strip()]
            # Deduplicate while preserving order, and drop fragments that are
            # already fully contained within an earlier (longer) part.
            _seen = set()
            _unique_parts = []
            for _p in _promo_parts:
                _key = _p.upper()
                if _key in _seen:
                    continue
                # Skip this part if it's a substring of any already-accepted part
                # e.g. "ACCA" is inside "ACCA BOOST" — redundant
                if any(_key in _accepted.upper() for _accepted in _unique_parts):
                    continue
                _seen.add(_key)
                _unique_parts.append(_p)
            headline_text = _unique_parts[0] if _unique_parts else promo_pick
            # Secondary: remaining unique parts joined naturally (no pipe characters in the ad)
            secondary_text = ' '.join(_unique_parts[1:]) if len(_unique_parts) > 1 else ''

            headline_note = (
                'TYPOGRAPHY IS THE HERO: The most dominant element must be a massive, '
                'thick ALL-CAPS headline filling at least 30% of the image height — billboard-scale. '
                f'The headline must be exactly: "{headline_text}" in ALL CAPS. '
                'Do NOT invent any other bonus amount, percentage, coin value, or promotional claim. '
                'The headline must be the single largest visual element — 3-4x larger than all other text. '
            )
            if secondary_text:
                promo_note = (
                    f'Directly below the headline, render this supporting promo line verbatim: '
                    f'"{secondary_text}". Large mixed-case bold text, about half the headline size. '
                    'Do not paraphrase, shorten, or alter this text in any way. '
                    'This secondary line must NOT repeat the headline — it provides additional detail. '
                )
            else:
                promo_note = ''
        else:
            promo_pick = ''
            headline_text = ''
            secondary_text = ''
            # No brand kit promos available — no specific offer, just brand call-to-action
            headline_note = (
                'TYPOGRAPHY IS THE HERO: The most dominant element must be a massive, '
                'thick ALL-CAPS headline filling at least 30% of the image height — billboard-scale. '
                'Use a SHORT, generic call-to-action headline only (e.g. "PLAY NOW", "JOIN TODAY", "SPIN FREE"). '
                'CRITICAL: Do NOT invent any bonus amounts, percentages, coin values, or specific promotional offers. '
                'No numbers in the headline unless they came from the brand kit. '
            )
            promo_note = ''

        # 2. Derive visual concept from the promo via Claude Sonnet ──────────────
        # The concept is semantically tied to the promo — not random fantasy.
        picked_theme = _derive_visual_concept(promo_pick, fingerprint_dna)

        # 3. Variable DNA — shuffle & pick 2 to avoid sameness ──────────────────
        _variable_pool = [
            ('Composition', fingerprint_dna.get('composition', '')),
            ('Lighting', fingerprint_dna.get('lighting', '')),
            ('Background', fingerprint_dna.get('background', '')),
            ('Typography', fingerprint_dna.get('typography', '')),
        ]
        _variable_pool = [(k, v) for k, v in _variable_pool if v]
        _picked_vars = _random.sample(_variable_pool, min(2, len(_variable_pool)))
        variable_note = ' '.join(f'{k}: {v}.' for k, v in _picked_vars)

        # 4. Style direction from ranked tags (pick 2 random) ───────────────────
        _tags = fingerprint_dna.get('style_tags', [])
        _tag_picks = _random.sample(_tags, min(2, len(_tags))) if _tags else []
        style_tags_note = f'Style direction: {", ".join(_tag_picks)}. ' if _tag_picks else ''

        # 5. Fixed brand invariants ──────────────────────────────────────────────
        avoid_note = f'Avoid: {fingerprint_dna["avoid_summary"]}. ' if fingerprint_dna['avoid_summary'] else ''
        tone_note = f'Brand tone: {", ".join(fingerprint_dna["brand_tone"][:3])}. ' if fingerprint_dna['brand_tone'] else ''
        cta_text = _pick_cta(_get_workspace_cta_pool(job.workspace))

        # 6. Optional mascot inclusion (~35% of generations) ─────────────────────
        # Pick a random character image from the brand kit. Upload to fal CDN and
        # store as a transient attribute on the job for _run_image_model to consume.
        mascot_note = ''
        job._auto_mascot_url = None  # reset transient attribute every call
        if _random.random() < 0.35:
            try:
                from apps.brand_kit.models import CharacterImage as _CharImg
                from apps.fingerprint.services import _upload_local_file as _upload_img
                _mascot_candidates = list(
                    _CharImg.objects.filter(
                        character__workspace=job.workspace,
                        caption_status='done',
                    ).exclude(caption='').select_related('character').order_by('-uploaded_at')[:10]
                )
                if _mascot_candidates:
                    _picked_mascot = _random.choice(_mascot_candidates)
                    _mascot_cdn_url = _upload_img(_picked_mascot.file.path)
                    job._auto_mascot_url = _mascot_cdn_url
                    _char_name = _picked_mascot.character.name
                    _char_desc = (_picked_mascot.caption or '')[:200]
                    mascot_note = (
                        f'The reference image shows the brand mascot character "{_char_name}". '
                        f'Include this mascot in the ad as a bold, dynamic supporting visual element. '
                        f'Character description: {_char_desc}. '
                        'Position the mascot so it NEVER obscures the headline text — '
                        'headline always dominates. The mascot adds energy and personality '
                        'alongside the typography, not instead of it. '
                    )
                    logger.info(
                        'auto_mascot.selected job_id=%s character=%s', job.id, _char_name
                    )
            except Exception as _me:
                logger.warning('auto_mascot.failed: %s', _me)

        simplicity_note = _simplicity_note(job.simplicity_weight) if job.simplicity_weight is not None else ''
        base_prompt = (
            f'{style_hint}'
            f'{simplicity_note}'
            f'Art style: {fingerprint_dna["art_style"]}. '
            f'Color palette: {fingerprint_dna["color_names"]}. '
            f'{variable_note} '
            f'{style_tags_note}'
            f'{tone_note}'
            f'{avoid_note}'
            f'Creative concept: {picked_theme}. '
            f'{_BANNED_VISUAL_TROPES}'
            f'{mascot_note}'
            'Build a complete iGaming advertisement around this concept where promotional text is BIG and dominant. '
            f'{headline_note}'
            f'{promo_note}'
            f'Include a bold call-to-action button with the text "{cta_text}". '
            'IMPORTANT: Do NOT write any brand name, company name, or app name anywhere in the image — all text must be generic promotional copy only. '
            'No logos, no real money signs. '
            f'{blacklist_note}'
            f'Include this disclaimer rendered small at the very bottom: "{disclaimer_text}". '
        )
        vibe = fingerprint_dna['summary'][:120] if fingerprint_dna['summary'] else 'Brand-aligned iGaming creative'
        colors = [c.get('hex', '') for c in fingerprint_dna['color_list'][:3] if isinstance(c, dict) and c.get('hex')]
        if not colors:
            colors = ['#0d1b2a', '#e8c558', '#c1121f']
    else:
        _fallback_cta = _pick_cta(_get_workspace_cta_pool(job.workspace))
        simplicity_note = _simplicity_note(job.simplicity_weight) if job.simplicity_weight is not None else ''
        base_prompt = (
            f'{style_hint}'
            f'{simplicity_note}'
            'A high-impact iGaming / sports-betting advertisement creative. '
            'Premium online casino or sportsbook visual. '
            'TYPOGRAPHY IS THE HERO: The most dominant element must be a massive, thick ALL-CAPS headline '
            'filling at least 30% of the image height — billboard-scale. '
            'Use a short, generic call-to-action headline only (e.g. "PLAY NOW", "JOIN TODAY", "SPIN FREE"). '
            'CRITICAL: Do NOT invent any bonus amounts, percentages, coin values, or specific promotional offers. '
            f'A bold call-to-action button with text "{_fallback_cta}". '
            'Dynamic, exciting, premium atmosphere. '
            'Color palette: deep navy or dark background with gold, electric blue, or crimson accents. '
            'Winning imagery, dynamic lighting and particle effects. '
            'IMPORTANT: Do NOT write any brand name, company name, or app name anywhere in the image — all text must be generic promotional copy only. '
            'No logos, no real money signs. '
            f'{blacklist_note}'
            f'Include this disclaimer rendered small at the very bottom: "{disclaimer_text}". '
        )
        vibe = 'Dynamic, high-energy, premium iGaming aesthetic'
        colors = ['#0d1b2a', '#e8c558', '#c1121f']

    if job.extra_prompt and job.extra_prompt.strip():
        clean_extra = re.sub(r'@\[([^\]]+)\]', r'\1', job.extra_prompt.strip())
        # ----------------------------------------------------------------
        # User's extra_prompt IS the creative brief — it takes full control
        # of concept and style.  Appending the full DNA base_prompt would
        # override a deliberately different art direction (e.g. "minimalist
        # smartphone, Apple-commercial aesthetic" vs. "glossy 3D dragon").
        #
        # We only inject: CTA text + blacklist + disclaimer.
        # Color palette is added as a soft reference only when it doesn't
        # conflict with explicit style directives in the extra_prompt.
        # ----------------------------------------------------------------
        if fingerprint_dna:
            cta_addon = f'Include a bold CTA button with the text "{cta_text}". '
            color_ref = f'Color reference (adapt freely to suit the concept above): {fingerprint_dna["color_names"]}. '
            # Promo ONLY from brand kit promo_themes — never invented
            _bk_ep_promos = fingerprint_dna.get('promo_themes') or []
            if _bk_ep_promos:
                _ep_promo_pick = _random.choice(_bk_ep_promos)
                _ep_headline_note = (
                    'Include a bold ALL-CAPS promotional headline that references '
                    f'this specific offer: "{_ep_promo_pick}". '
                    'Do NOT invent bonus amounts or percentages not in this offer. '
                )
                _ep_promo_note = (
                    f'Add this EXACT secondary promo line verbatim (do not alter it): "{_ep_promo_pick}". '
                )
            else:
                _ep_headline_note = (
                    'Include a short generic ALL-CAPS headline only (e.g. "PLAY NOW", "JOIN TODAY"). '
                    'CRITICAL: Do NOT invent any bonus amounts, percentages, or coin values. '
                )
                _ep_promo_note = ''
            master = (
                f'{clean_extra}\n\n'
                f'{color_ref}'
                f'{_ep_headline_note}'
                f'{_ep_promo_note}'
                f'{cta_addon}'
                f'{avoid_note}'
                f'{blacklist_note}'
                f'Include this disclaimer rendered small at the very bottom: "{disclaimer_text}".'
            )
        else:
            fallback_cta = _pick_cta(_get_workspace_cta_pool(job.workspace))
            master = (
                f'{clean_extra}\n\n'
                'Include a bold ALL-CAPS promotional headline in the upper area of the image. '
                f'Include a bold CTA button with the text "{fallback_cta}". '
                f'{blacklist_note}'
                f'Include this disclaimer rendered small at the very bottom: "{disclaimer_text}".'
            )
    else:
        master = base_prompt

    job.master_prompt = master
    job.vibe_and_atmosphere = vibe
    job.recommended_colors = colors

    save_fields = ['master_prompt', 'vibe_and_atmosphere', 'recommended_colors']

    job.save(update_fields=save_fields)


def _simplicity_note(weight: int) -> str:
    """Return a prompt instruction fragment based on simplicity_weight (0-100).
    0 = richly detailed, 100 = ultra-minimal."""
    if weight <= 20:
        return (
            'VISUAL COMPLEXITY: Rich, layered composition. Use detailed backgrounds, '
            'decorative elements, particles, and depth to create a visually dense, '
            'premium ad aesthetic. '
        )
    elif weight <= 40:
        return (
            'VISUAL COMPLEXITY: Moderately detailed — keep the main subject rich but '
            'limit background clutter. A few supporting decorative elements, clean hierarchy. '
        )
    elif weight <= 60:
        return (
            'VISUAL COMPLEXITY: Balanced. Focused composition with clear visual hierarchy. '
            'Avoid excessive decoration while keeping energy and impact. '
        )
    elif weight <= 80:
        return (
            'VISUAL STYLE: Minimal and clean. Simple background, maximum negative space. '
            'One strong hero element. No particle effects, no busy decorations. '
            'Flat or lightly textured surfaces only. '
        )
    else:
        return (
            'VISUAL STYLE: Ultra-minimal. Stark, elegant simplicity — a single bold subject '
            'on a near-empty background. Strip away all decorative elements, patterns, particles, '
            'and secondary visuals. Generous negative space. Pure, uncluttered layout. '
        )


def _get_workspace_cta_pool(workspace) -> list:
    """Return distinct CTA texts from the workspace's fingerprint corpus. Used as
    a replacement pool when 'CTA' appears as a placeholder in image prompts."""
    from apps.fingerprint.models import ImageAnalysisRecord
    records = (
        ImageAnalysisRecord.objects
        .filter(workspace=workspace)
        .order_by('-rating', '-created_at')
        .values_list('analysis', flat=True)[:40]
    )
    seen, ctas = set(), []
    for analysis in records:
        if not analysis:
            continue
        cta_text = (analysis.get('branding_elements') or {}).get('cta_text') or ''
        for part in re.split(r'\s*[/|,»]\s*', cta_text):
            part = part.strip()
            if part and part.upper() not in seen and len(part) < 40:
                seen.add(part.upper())
                ctas.append(part)
    return ctas or ['GET OFFER', 'PLAY NOW', 'CLAIM NOW']


def _get_workspace_headline_pool(workspace) -> tuple:
    """Return (headlines, promos) lists from the workspace's fingerprint corpus.
    Used to add promotional headline text to auto-mode prompts."""
    from apps.fingerprint.models import ImageAnalysisRecord
    records = (
        ImageAnalysisRecord.objects
        .filter(workspace=workspace)
        .order_by('-rating', '-created_at')
        .values_list('analysis', flat=True)[:40]
    )
    seen_h, seen_p = set(), set()
    headlines, promos = [], []
    skip_terms = ('21+', '18+', 'terms', 'conditions', 'responsible', 'void')
    for analysis in records:
        if not analysis:
            continue
        typo = (analysis.get('typography_in_image') or {})
        h = (typo.get('headline_text') or '').strip()
        b = (typo.get('body_text') or '').strip()
        if h and 5 < len(h) < 80 and not any(t in h.lower() for t in skip_terms) and h.upper() not in seen_h:
            seen_h.add(h.upper())
            headlines.append(h)
        if b and 5 < len(b) < 80 and not any(t in b.lower() for t in skip_terms) and b.upper() not in seen_p:
            seen_p.add(b.upper())
            promos.append(b)
    return headlines[:5], promos[:4]


# ─── Quality Scoring ─────────────────────────────────────────────────────────

_QUALITY_SYSTEM_PROMPT = """You are a brutally honest creative director who has reviewed thousands of AI-generated iGaming ads. You have seen every generic template, every inflated score, and every mediocre creative that slipped through a lenient reviewer. Your job is to protect the client — a "pass" from you means the creative is genuinely good enough to run on a paid campaign without embarrassing anyone.

CRITICAL MINDSET:
- The BASELINE for an AI-generated iGaming ad is mediocre (score 2–3). A score of 4 requires concrete evidence of excellence. A 5 is rare — near-perfection only.
- When deciding between two adjacent scores, ALWAYS choose the lower one. The burden of proof is on the creative to earn a higher score.
- "Looks okay" = 2. "Actually good" = 3. "Genuinely impressive" = 4. "Portfolio-worthy" = 5.
- A creative that commits ANY of the following automatic failures scores a maximum of 2 on that dimension regardless of other qualities: garbled/broken text, AI hand/face deformity visible in center frame, invented promotional claims, headline that isn't the largest element.

You will receive:
1. A generated creative image
2. The brand's visual identity data
3. Generation context including the intended prompt

SCORE EACH DIMENSION 1–5 (integers only):

BRAND_ALIGNMENT — Does this unmistakably look like THIS brand, not a generic iGaming template?
5: Unmistakably this brand — someone who knows the brand would recognize it with the logo covered
4: Clearly this brand — strong match on both color AND style; only one trivial deviation
3: Partially matches — hits colors OR style but not both; generic competitor could run it
2: Surface resemblance only — uses correct colors but nothing else is brand-specific
1: Could be any iGaming brand or no brand at all; style and colors are generic defaults

AD_EFFECTIVENESS — Would this stop a real social-media scroll and convert in under 2 seconds?
5: Stops the scroll instantly — dominant hero element + clear hierarchy + legible offer at thumbnail scale; a professional would approve this without changes
4: Attention-grabbing with a specific, concrete reason — names exactly what makes it work
3: Functional but forgettable — communicates the offer but offers no reason to prefer it over a template
2: Weak focal point or confused hierarchy — takes >3 seconds to understand the message
1: No clear message; would be scrolled past without any engagement

TEXT_QUALITY — Is every text element legible, correctly sized, and AI-artifact-free?
5: Headline is billboard-dominant (fills ≥30% image height), all text crisp and artifact-free, hierarchy immediately clear
4: Strong hierarchy with one minor imperfection (slight edge blur on one word, minor color contrast issue)
3: Readable but headline is NOT clearly dominant; or one text element is noticeably soft/blurred
2: Garbled characters in any word, or headline is NOT the largest text element, or CTA is missing/unreadable
1: Text is broken, unreadable, absent, or the creative has no meaningful text at all

PRODUCTION_QUALITY — Technical polish, AI artifacts, visual coherence
5: Clean and professional — no visible AI artifacts, coherent lighting, no distorted anatomy; could pass as human-made
4: High quality with ONE minor peripheral artifact (edge of frame, background element only)
3: Acceptable quality — artifact(s) present but not in the focal area; impression is still professional at a glance
2: Notable artifact in the center or focal area — distorted hands/face, inconsistent lighting on hero subject, obvious compositing failure
1: Severely distorted — AI failure is the first thing you notice; unpublishable

OFFER_ACCURACY — Does ALL promotional copy match ONLY the brand's verified known promotions?
The brand's KNOWN REAL PROMOTIONS are listed in the user message. Any specific claim in the image must match one.
5: Every promotional claim matches a known real promotion verbatim or near-verbatim; nothing invented
4: Very minor variation of a known promo (abbreviation, synonym) — the intent is clearly the same offer
3: Purely generic copy ("PLAY NOW", "JOIN TODAY") — no specific offer claimed; safe but scores no higher than 3
2: Any specific number, percentage, coin value, or bonus amount that is NOT in the known promotions list
1: Completely invented promotion, incoherent copy, or multiple fabricated claims
HARD RULE: If the image shows ANY specific promotional figure not in the known list, score 2 or lower — "looks realistic" or "looks like a real offer" does NOT qualify.

OVERALL (1.0–5.0, one decimal):
- Weighted toward AD_EFFECTIVENESS and BRAND_ALIGNMENT.
- Hard caps (non-negotiable):
  * Any dimension score of 1 → overall cannot exceed 2.0
  * TEXT_QUALITY ≤ 2 → overall cannot exceed 2.5
  * OFFER_ACCURACY ≤ 2 → overall cannot exceed 2.5
  * BRAND_ALIGNMENT ≤ 2 → overall cannot exceed 3.0
  * PRODUCTION_QUALITY = 2 center-frame artifact → overall cannot exceed 3.5
- Do NOT average the five dimensions and call it a day. Apply your holistic commercial judgment WITH these caps enforced.

VERDICT (must be consistent with overall score):
"pass"   → overall ≥ 4.0 — ready to run on a paid campaign without human review
"review" → overall 3.0–3.9 — shows promise but has at least one specific issue that a human must verify
"fail"   → overall < 3.0 — do not send; regenerate or discard

NOTES: Exactly two sentences. Be specific and ruthless.
Sentence 1: the single biggest strength — name the exact visual element and why it works.
Sentence 2: the single most critical flaw — name exactly what fails and the commercial consequence (e.g. "garbled headline text would make this unshareable on any platform").
Do not hedge. Do not say "overall it looks good." Name things.

Output ONLY valid JSON, no prose, no markdown fences:
{
  "brand_alignment": int,
  "ad_effectiveness": int,
  "text_quality": int,
  "production_quality": int,
  "offer_accuracy": int,
  "overall": float,
  "verdict": "pass" | "review" | "fail",
  "notes": "string"
}"""


def _evaluate_creative_worker(creative_id):
    """Evaluate a single GeneratedCreative using Claude vision. Runs in background thread."""
    from django.db import close_old_connections, connection
    from .models import CreativeQualityScore
    close_old_connections()
    try:
        creative = GeneratedCreative.objects.select_related('job', 'workspace').get(id=creative_id)

        score_obj, _ = CreativeQualityScore.objects.get_or_create(creative=creative)
        if score_obj.status == 'done':
            return  # already evaluated

        if not creative.image_url:
            score_obj.status = 'error'
            score_obj.save(update_fields=['status'])
            return

        # Build brand context for user message
        dna = _load_fingerprint_dna(creative.workspace_id) or {}
        brand_ctx_parts = []
        if dna.get('art_style'):
            brand_ctx_parts.append(f"Art style: {dna['art_style']}")
        if dna.get('color_names'):
            brand_ctx_parts.append(f"Color palette: {dna['color_names']}")
        if dna.get('style_tags'):
            brand_ctx_parts.append(f"Style tags: {', '.join(dna['style_tags'][:5])}")
        if dna.get('summary'):
            brand_ctx_parts.append(f"Brand summary: {dna['summary']}")
        if dna.get('avoid_summary'):
            brand_ctx_parts.append(f"Avoid: {dna['avoid_summary']}")
        if dna.get('promo_themes'):
            promo_list = '\n'.join(f'  - {p}' for p in dna['promo_themes'][:6])
            brand_ctx_parts.append(f"KNOWN REAL PROMOTIONS (the ONLY acceptable specific offers — any other claim is fabricated):\n{promo_list}")

        brand_ctx = '\n'.join(brand_ctx_parts) if brand_ctx_parts else 'No brand fingerprint available — evaluate on general iGaming ad quality standards.'

        job = creative.job
        gen_ctx = ''
        if job:
            gen_ctx = f"Generation mode: {job.generation_mode}. Model: {job.model_name}. Style: {job.style or 'default'}."
            if job.master_prompt:
                gen_ctx += f"\nIntended prompt (first 300 chars): {job.master_prompt[:300]}"

        user_message = (
            f"Evaluate this generated advertising creative.\n\n"
            f"BRAND VISUAL IDENTITY:\n{brand_ctx}\n\n"
            f"GENERATION CONTEXT:\n{gen_ctx}\n\n"
            "Score the creative against each dimension and return the JSON evaluation."
        )

        connection.close()
        from apps.fingerprint.services import _call_vision_api, _set_fal_key
        _set_fal_key()
        raw = _call_vision_api(
            image_urls=[creative.image_url],
            system_prompt=_QUALITY_SYSTEM_PROMPT,
            user_prompt=user_message,
        )
        connection.close()

        data = json.loads(raw.strip().lstrip('```json').rstrip('```').strip())

        score_obj.brand_alignment    = int(data.get('brand_alignment', 0)) or None
        score_obj.ad_effectiveness   = int(data.get('ad_effectiveness', 0)) or None
        score_obj.text_quality       = int(data.get('text_quality', 0)) or None
        score_obj.production_quality = int(data.get('production_quality', 0)) or None
        score_obj.offer_accuracy     = int(data.get('offer_accuracy', 0)) or None
        score_obj.overall            = float(data.get('overall', 0)) or None
        score_obj.verdict            = data.get('verdict', 'review')
        score_obj.notes              = data.get('notes', '')
        score_obj.status             = 'done'
        from django.utils import timezone
        score_obj.evaluated_at = timezone.now()
        score_obj.save()
        logger.info("quality.evaluated creative_id=%s verdict=%s overall=%.1f",
                    creative_id, score_obj.verdict, score_obj.overall or 0)

    except Exception as exc:
        logger.error("quality.evaluation_failed creative_id=%s: %s", creative_id, traceback.format_exc())
        try:
            c = GeneratedCreative.objects.get(id=creative_id)
            CreativeQualityScore.objects.filter(creative=c).update(status='error')
        except Exception:
            pass


def evaluate_creative_async(creative_id):
    """Fire-and-forget quality evaluation for a single creative."""
    t = threading.Thread(target=_evaluate_creative_worker, args=(creative_id,), daemon=True)
    t.start()


def _pick_cta(pool: list) -> str:
    """Pick a CTA from pool. Prefers ≤2-word imperative CTAs (PLAY NOW, GET OFFER)
    over longer game-specific copy (UNLOCK COSMIC SECRETS, PLAY THE GALAXY)."""
    import random
    imperative = [c for c in pool if len(c.split()) <= 2]
    return random.choice(imperative) if imperative else random.choice(pool)


def _sanitize_cta_prompt(prompt: str, cta_pool: list = None) -> str:
    """Replace generic 'CTA' placeholder references that would cause the image model
    to render the literal word 'CTA' as button text. Picks from workspace CTA pool."""
    if not cta_pool:
        cta_pool = ['GET OFFER', 'PLAY NOW', 'CLAIM NOW', 'SPIN FREE']

    def replacement(m):
        chosen = _pick_cta(cta_pool)
        # Re-insert whatever prefix/suffix the pattern captured around CTA
        groups = m.groups()
        if len(groups) == 1:
            return f'{groups[0]} "{chosen}"'
        if len(groups) == 2:
            return f'"{chosen}" {groups[1]}'
        return f'"{chosen}"'

    patterns = [
        # "labeled/reading/saying CTA"  →  keep verb, replace CTA with chosen
        re.compile(r'\b(labeled|reading|reads|saying|says|with text|text reads?)\s+["\']?CTA["\']?\b', re.IGNORECASE),
        # "CTA button/badge/label/pill"  →  "CHOSEN" button
        re.compile(r'\bCTA\s+(button|badge|label|text|starburst|burst|callout|pill)\b', re.IGNORECASE),
        # "bold/orange/a/the CTA" (standalone noun)
        re.compile(r'\b(bold|large|big|bright|glowing|golden|orange|green|blue|white|red|yellow|a|the|an)\s+CTA\b(?!\s*:)(?!\s*["\'])', re.IGNORECASE),
    ]
    for p in patterns:
        prompt = p.sub(replacement, prompt)
    return prompt


def _run_image_model(job):
    model_id = MODEL_MAP.get(job.model_name, 'fal-ai/nano-banana-2')
    raw_extra = re.sub(r'@\[([^\]]+)\]', r'\1', job.extra_prompt) if job.extra_prompt else ''
    prompt = job.master_prompt or raw_extra or 'A professional iGaming advertisement'
    cta_pool = _get_workspace_cta_pool(job.workspace)
    prompt = _sanitize_cta_prompt(prompt, cta_pool)

    # Append blacklist enforcement directly to the image model prompt
    blacklist = list(job.workspace.disclaimer_keywords.values_list('keyword', flat=True))
    if blacklist:
        terms = ', '.join(f'"{k}"' for k in blacklist)
        prompt = f'{prompt}\nCRITICAL: Do NOT render any of the following words as visible text anywhere in the image: {terms}.'

    if model_id == 'openai/gpt-image-2':
        gpt_size = GPT_IMAGE_2_SIZES.get(job.aspect_ratio, {'width': 1024, 'height': 1024})
        # OpenAI gpt-image-2 doesn't support a separate negative_prompt field.
        # Inject it as explicit instructions at the end of the prompt — this is the only reliable way.
        gpt_prompt = prompt
        if job.negative_prompt:
            gpt_prompt = f'{prompt}\n\nIMPORTANT — do NOT include the following in the image: {job.negative_prompt}'
        gpt_args = {
            'prompt': gpt_prompt,
            'num_images': job.num_images,
            'image_size': gpt_size,
            'quality': job.image_quality or 'high',
            'output_format': job.output_format or 'png',
        }
        # Auto-mode mascot: if a character image was uploaded, pass it as a reference
        _mascot_url = getattr(job, '_auto_mascot_url', None)
        if _mascot_url:
            gpt_args['image_urls'] = [_mascot_url]
        result = fal_client.subscribe(model_id, arguments=gpt_args)
    elif model_id == 'xai/grok-imagine-image':
        grok_resolution = job.resolution.lower() if job.resolution.lower() in ('1k', '2k') else '1k'
        args = {
            'prompt': prompt,
            'num_images': job.num_images,
            'aspect_ratio': job.aspect_ratio,
            'resolution': grok_resolution,
            'output_format': job.output_format or 'png',
        }
        if job.negative_prompt:
            args['negative_prompt'] = job.negative_prompt
        result = fal_client.subscribe(model_id, arguments=args)

    elif model_id == 'bytedance/seedream/v5/pro/text-to-image':
        # Seedream accepts custom {width, height}; min area 1024×1024, max 2048×2048.
        # No native negative_prompt — inject into prompt.
        res_key = (job.aspect_ratio or '1:1', job.resolution or '1K')
        img_size = CUSTOM_IMAGE_SIZES.get(res_key, {'width': 1024, 'height': 1024})
        sd_prompt = prompt
        if job.negative_prompt:
            sd_prompt = f'{prompt}\n\nDo NOT include any of the following in the image: {job.negative_prompt}'
        result = fal_client.subscribe(model_id, arguments={
            'prompt': sd_prompt,
            'num_images': job.num_images,
            'image_size': img_size,
            'output_format': job.output_format or 'jpeg',
        })

    elif model_id == 'ideogram/v4':
        # Ideogram uses fal named presets; rendering speed maps to resolution tier.
        img_size = ASPECT_TO_SIZE.get(job.aspect_ratio or '1:1', 'square_hd')
        speed = 'QUALITY'
        id_prompt = prompt
        if job.negative_prompt:
            id_prompt = f'{prompt}\n\nDo NOT include any of the following in the image: {job.negative_prompt}'
        result = fal_client.subscribe(model_id, arguments={
            'prompt': id_prompt,
            'num_images': min(job.num_images, 4),   # Ideogram max is 4
            'image_size': img_size,
            'rendering_speed': speed,
            'output_format': job.output_format or 'jpeg',
        })

    elif model_id == 'fal-ai/qwen-image-2/pro/text-to-image':
        # Qwen accepts custom {width, height}; min area 512×512, max 2048×2048.
        # No native negative_prompt — inject into prompt.
        res_key = (job.aspect_ratio or '1:1', job.resolution or '1K')
        img_size = CUSTOM_IMAGE_SIZES.get(res_key, {'width': 1024, 'height': 1024})
        qw_prompt = prompt
        if job.negative_prompt:
            qw_prompt = f'{prompt}\n\nDo NOT include any of the following in the image: {job.negative_prompt}'
        result = fal_client.subscribe(model_id, arguments={
            'prompt': qw_prompt,
            'num_images': job.num_images,
            'image_size': img_size,
            'output_format': job.output_format or 'jpeg',
        })

    elif model_id == 'fal-ai/nano-banana-pro':
        # Nano Banana Pro — same schema as NB2 but safety_tolerance is a string
        # and there's no native negative_prompt (inject into prompt instead).
        nb_prompt = prompt
        if job.negative_prompt:
            nb_prompt = f'{prompt}\n\nDo NOT include any of the following in the image: {job.negative_prompt}'
        result = fal_client.subscribe(model_id, arguments={
            'prompt': nb_prompt,
            'num_images': job.num_images,
            'aspect_ratio': job.aspect_ratio,
            'resolution': job.resolution or '1K',
            'output_format': job.output_format or 'png',
            'safety_tolerance': '4',
        })

    else:
        # Nano Banana 2 (default)
        args = {
            'prompt': prompt,
            'num_images': job.num_images,
            'aspect_ratio': job.aspect_ratio,
            'resolution': job.resolution,
            'output_format': job.output_format or 'png',
            'safety_tolerance': 4,
        }
        if job.negative_prompt:
            args['negative_prompt'] = job.negative_prompt
        result = fal_client.subscribe(model_id, arguments=args)

    if isinstance(result, dict):
        images = result.get('images', [])
        return [img.get('url', '') for img in images if img.get('url')]

    return []


def _deduct_credits(workspace, count, description):
    try:
        sub = workspace.subscription
        # Enterprise (unlimited_usage) — log usage for analytics but don't block/decrement
        sub.credit_used   += count
        if not sub.plan.unlimited_usage:
            sub.monthly_usage += count
            sub.save(update_fields=['monthly_usage', 'credit_used'])
        else:
            sub.save(update_fields=['credit_used'])
        CreditTransaction.objects.create(
            workspace=workspace,
            amount=count,
            transaction_type='debit',
            description=description,
            reference_type='generation',
        )
    except Exception:
        pass


# ─── Video generation ─────────────────────────────────────────────────────────

def make_video_async(vjob_id):
    t = threading.Thread(target=_video_worker, args=(vjob_id,), daemon=True)
    t.start()


def _video_worker(vjob_id):
    from django.db import close_old_connections
    close_old_connections()

    os.environ['FAL_KEY'] = settings.FAL_KEY
    try:
        vjob = VideoJob.objects.get(pk=vjob_id)

        # Kling API requires a public HTTPS URL.
        # Re-host only genuine localhost/dev URLs (e.g. http://localhost:8001/media/…).
        # Any other non-https URL is rejected here as a defence-in-depth SSRF guard —
        # the view layer already enforces the allowlist before DB write.
        source_url = vjob.source_image_url
        if source_url and not source_url.startswith('https://'):
            import tempfile, urllib.request
            from urllib.parse import urlparse as _urlparse
            _host = _urlparse(source_url).hostname or ''
            if _host not in ('localhost', '127.0.0.1', '0.0.0.0'):
                raise ValueError(
                    f'SSRF guard: refusing to fetch non-local URL "{source_url}" in video worker.'
                )
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                urllib.request.urlretrieve(source_url, tmp.name)
                source_url = fal_client.upload_file(tmp.name)

        # submit() returns immediately with a request handle — restart-safe
        handle = fal_client.submit(
            'fal-ai/kling-video/v3/pro/image-to-video',
            arguments={
                'start_image_url': source_url,
                'prompt': vjob.prompt or 'Smooth cinematic motion',
                'duration': str(vjob.duration),
                'generate_audio': False,
                'negative_prompt': 'blur, distort, and low quality',
                'cfg_scale': 0.5,
            },
        )
        # Store request_id in DB immediately so scheduler can poll even after restart
        VideoJob.objects.filter(pk=vjob_id).update(
            status='processing',
            fal_request_id=handle.request_id,
        )

    except Exception as e:
        try:
            VideoJob.objects.filter(pk=vjob_id).update(status='error', error_message=str(e)[:500])
        except Exception:
            pass


def _video_poll_complete(vjob, result):
    from django.db import close_old_connections
    close_old_connections()

    video_url = ''
    if isinstance(result, dict):
        video = result.get('video', {})
        video_url = video.get('url', '') if isinstance(video, dict) else ''

    vjob.video_url = video_url
    vjob.status = 'done' if video_url else 'error'
    if not video_url:
        vjob.error_message = 'No video URL in fal response'
    vjob.fal_request_id = ''
    vjob.save(update_fields=['status', 'video_url', 'fal_request_id', 'error_message'])

    if vjob.source_creative:
        try:
            sc = vjob.source_creative
            sc.media_type = 'Video'
            if sc.name:
                sc.name = re.sub(r'_S_', '_V_', sc.name, count=1)
            sc.save(update_fields=['media_type', 'name'])
        except Exception:
            pass

    if video_url:
        try:
            log_event(vjob.workspace, vjob.created_by, 'make_video', 'Video generated')
        except Exception:
            pass
        try:
            from apps.slack_integration.services import notify_slack_video
            notify_slack_video(vjob.workspace, vjob)
        except Exception:
            pass
        try:
            from apps.drive_integration.services import auto_sync_video
            auto_sync_video(vjob.workspace, vjob)
        except Exception:
            pass


# ─── Logo placement ───────────────────────────────────────────────────────────

def _auto_place_logo_on_job(job):
    """Auto-composite job.logo onto every creative in the job (same logic as automation)."""
    from PIL import Image as PILImage
    from django.core.files.base import ContentFile
    from django.conf import settings
    from .models import LogoJob, LogoJobImage

    logo_path = job.logo.file.path
    logo_job = LogoJob.objects.create(workspace=job.workspace, created_by=job.created_by, source_job=job)

    logo_pil = PILImage.open(logo_path).convert('RGBA')
    bbox = logo_pil.split()[-1].getbbox()
    trimmed = logo_pil.crop(bbox) if bbox else logo_pil
    tw, th = trimmed.size

    site_base = getattr(settings, 'SITE_BASE_URL', '').rstrip('/')
    saved = 0

    for creative in job.creatives.all():
        try:
            img_bytes = _fetch_bytes(creative.image_url)
            base_img = PILImage.open(io.BytesIO(img_bytes))
            iw, ih = base_img.size
            max_w, max_h = int(iw * 0.24), int(ih * 0.20)
            scale = min(max_w / tw, max_h / th, 1.0)
            logo_w, logo_h = max(1, int(tw * scale)), max(1, int(th * scale))
            x, y, _ = _find_best_logo_position(img_bytes, logo_w, logo_h)

            result = composite_logos_manual(creative.image_url, [{
                'logo_path': logo_path, 'x': x, 'y': y,
                'logo_w': logo_w, 'logo_h': logo_h, 'angle_deg': 0, 'opacity': 1.0,
            }])
            buf = io.BytesIO()
            result.save(buf, format='PNG')
            buf.seek(0)
            lji = LogoJobImage(job=logo_job, source_creative=creative)
            lji.file.save(f'auto_{logo_job.pk}_{creative.pk}.png', ContentFile(buf.read()), save=True)
            creative.logo_applied_url = site_base + lji.file.url
            creative.save(update_fields=['logo_applied_url'])
            saved += 1
        except Exception:
            continue

    logo_job.status = 'done' if saved else 'error'
    logo_job.save(update_fields=['status'])


def _apply_drop_shadow(logo_img, blur_radius=8, shadow_opacity=120):
    from PIL import Image as PILImage, ImageFilter
    w, h = logo_img.size
    exp = blur_radius * 2
    try:
        alpha = logo_img.split()[-1]
    except Exception:
        alpha = PILImage.new('L', (w, h), 255)
    shadow = PILImage.new('RGBA', (w + exp * 2, h + exp * 2), (0, 0, 0, 0))
    sl = PILImage.new('RGBA', (w, h), (0, 0, 0, shadow_opacity))
    sl.putalpha(alpha)
    shadow.paste(sl, (exp, exp))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=blur_radius))
    result = PILImage.new('RGBA', (w + exp * 2, h + exp * 2), (0, 0, 0, 0))
    result.paste(shadow, (0, 0), shadow)
    result.paste(logo_img, (exp, exp), logo_img)
    return result, exp


def _fetch_bytes(url):
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.content


def _find_best_logo_position(img_bytes, logo_w, logo_h):
    from PIL import Image as PILImage
    pil_img = PILImage.open(io.BytesIO(img_bytes))
    iw, ih = pil_img.size
    try:
        import cv2
        import numpy as np

        nparr = np.frombuffer(img_bytes, np.uint8)
        cv_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        scale = min(1.0, 800 / max(iw, ih))
        small = cv2.resize(cv_img, (int(iw * scale), int(ih * scale))) if scale < 1.0 else cv_img
        sh, sw = small.shape[:2]
        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        lap = np.abs(cv2.Laplacian(gray, cv2.CV_64F))
        lw_s = max(1, int(logo_w * scale))
        lh_s = max(1, int(logo_h * scale))
        pad_x = max(1, int(sw * 0.05))
        pad_y = max(1, int(sh * 0.05))
        cx0 = sw // 2 - lw_s // 2
        candidates = [
            (cx0, pad_y, 0.85),
            (cx0, sh - lh_s - pad_y, 1.0),
            (pad_x, sh // 2 - lh_s // 2, 1.0),
            (sw - lw_s - pad_x, sh // 2 - lh_s // 2, 1.0),
        ]
        best_score, best_x, best_y = None, cx0, pad_y
        for cx_, cy_, bias in candidates:
            cx_ = max(0, min(cx_, sw - lw_s))
            cy_ = max(0, min(cy_, sh - lh_s))
            region = lap[cy_:cy_ + lh_s, cx_:cx_ + lw_s]
            if region.size == 0:
                continue
            score = float(np.mean(region)) * bias
            if best_score is None or score < best_score:
                best_score, best_x, best_y = score, cx_, cy_
        return int(best_x / scale), int(best_y / scale), (best_score or 0) > 15.0
    except Exception:
        pad = int(min(iw, ih) * 0.05)
        return iw - logo_w - pad, pad, False


def composite_logos_manual(image_url, logos):
    from PIL import Image as PILImage

    base = PILImage.open(io.BytesIO(_fetch_bytes(image_url))).convert('RGBA')
    for ld in logos:
        try:
            logo = PILImage.open(ld['logo_path']).convert('RGBA')
            bbox = logo.split()[-1].getbbox()
            if bbox:
                logo = logo.crop(bbox)
            logo = logo.resize((max(1, int(ld['logo_w'])), max(1, int(ld['logo_h']))), PILImage.LANCZOS)
            angle = ld.get('angle_deg', 0)
            if angle:
                logo = logo.rotate(-angle, expand=True, resample=PILImage.BICUBIC)
            opacity = float(ld.get('opacity', 1.0))
            if opacity < 1.0:
                r, g, b, a = logo.split()
                logo = PILImage.merge('RGBA', (r, g, b, a.point(lambda v: int(v * opacity))))
            shadowed, offset = _apply_drop_shadow(logo)
            base.paste(shadowed, (int(ld['x']) - offset, int(ld['y']) - offset), shadowed)
        except Exception:
            continue
    return base.convert('RGB')


def calculate_logo_placements(job, logo):
    from PIL import Image as PILImage

    logo_pil = PILImage.open(logo.file.path).convert('RGBA')
    natural_w, natural_h = logo_pil.size
    bbox = logo_pil.split()[-1].getbbox()
    if bbox:
        trim_left, trim_top, trim_right, trim_bottom = bbox
    else:
        trim_left, trim_top, trim_right, trim_bottom = 0, 0, natural_w, natural_h
    trimmed_w = max(1, trim_right - trim_left)
    trimmed_h = max(1, trim_bottom - trim_top)

    results = []
    for creative in job.creatives.all():
        img_bytes = b''
        try:
            img_bytes = _fetch_bytes(creative.image_url)
            img_pil = PILImage.open(io.BytesIO(img_bytes))
            img_w, img_h = img_pil.size
        except Exception:
            img_w, img_h = 1024, 1024

        scale = min(int(img_w * 0.24) / trimmed_w, int(img_h * 0.20) / trimmed_h, 1.0)
        logo_w = max(1, int(trimmed_w * scale))
        logo_h = max(1, int(trimmed_h * scale))

        if img_bytes:
            x, y, too_busy = _find_best_logo_position(img_bytes, logo_w, logo_h)
        else:
            pad = int(min(img_w, img_h) * 0.05)
            x, y, too_busy = img_w - logo_w - pad, pad, False

        # Clamp to ensure logo stays within image bounds
        x = max(0, min(x, img_w - logo_w))
        y = max(0, min(y, img_h - logo_h))

        results.append({
            'creative_id': creative.id,
            'image_url': creative.image_url,
            'img_w': img_w,
            'img_h': img_h,
            'x': x,
            'y': y,
            'logo_w': logo_w,
            'logo_h': logo_h,
            'too_busy': too_busy,
            'natural_w': natural_w,
            'natural_h': natural_h,
            'trim_left': trim_left,
            'trim_top': trim_top,
            'trimmed_w': trimmed_w,
            'trimmed_h': trimmed_h,
        })
    return results
