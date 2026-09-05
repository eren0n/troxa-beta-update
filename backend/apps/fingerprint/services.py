"""
Fingerprint service layer — all agents.

All worker functions run in background threads (daemon=True). They never raise
to the caller — failures are logged and the fingerprint is left unchanged.
"""
import json
import logging
import os
import re
import threading

import fal_client
from django.conf import settings
from django.db import transaction
from pydantic import ValidationError

from .models import BrandFingerprint, ImageAnalysisRecord
from .prompts import (
    AGENT1_SYSTEM_PROMPT,
    AGENT1_USER_PROMPT,
    AGENT2_SYSTEM_PROMPT,
    AGENT2_USER_PROMPT_TEMPLATE,
    AGENT3_SYSTEM_PROMPT,
    AGENT3_USER_PROMPT_TEMPLATE,
    AGENT4_SYSTEM_PROMPT,
    AGENT4_USER_PROMPT_TEMPLATE,
    PROMO_TEXT_EXTRACT_SYSTEM_PROMPT,
    PROMO_TEXT_EXTRACT_USER_PROMPT,
    SYNTHESIS_SYSTEM_PROMPT,
    SYNTHESIS_USER_PROMPT_TEMPLATE,
)
from .schemas import BrandProfileOutput, ImageAnalysisOutput, MergeOutput, PromptGenerationOutput, SynthesisOutput

logger = logging.getLogger("fingerprint")

# First-merge threshold: trigger Agent 4 when this many unmerged records exist
# (avoids waiting 24h for the very first visual_dna)
FIRST_MERGE_THRESHOLD = 3
# Daily volume threshold: trigger early merge when this many records pile up in one day
VOLUME_THRESHOLD = 25


# ─── Shared helpers ───────────────────────────────────────────────────────────

def _set_fal_key():
    """Ensure FAL_KEY env var is set before any fal_client call."""
    os.environ["FAL_KEY"] = settings.FAL_KEY


def _parse_json_output(text: str) -> dict:
    """
    Parse JSON from LLM output, tolerating markdown code fences and
    leading/trailing prose. Raises json.JSONDecodeError on failure.
    """
    text = text.strip()
    # Strip ```json ... ``` or ``` ... ```
    match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if match:
        text = match.group(1).strip()
    # Fallback: find the outermost { … }
    if not text.startswith("{"):
        start = text.find("{")
        if start != -1:
            text = text[start:]
    end = text.rfind("}")
    if end != -1:
        text = text[: end + 1]
    return json.loads(text)


def _call_vision_api(image_urls: list[str], system_prompt: str, user_prompt: str) -> str:
    """
    Call fal.ai OpenRouter vision endpoint.
    Returns the raw `output` string. Raises on API failure.
    """
    _set_fal_key()
    result = fal_client.subscribe(
        "openrouter/router/vision",
        arguments={
            "image_urls": image_urls,
            "system_prompt": system_prompt,
            "prompt": user_prompt,
            "model": "anthropic/claude-sonnet-5",
            "enable_web_search": False,
            "temperature": 0.2,
        },
    )
    return result["output"]


def _upload_local_file(file_path: str) -> str:
    """
    Upload a local file to fal CDN and return the public URL.
    Uses fal_client.upload(bytes, content_type) instead of upload_file(path)
    to avoid ASCII encoding errors on filenames with non-ASCII characters (Turkish etc.).
    """
    import mimetypes
    _set_fal_key()
    content_type = mimetypes.guess_type(file_path)[0] or "image/jpeg"
    with open(file_path, "rb") as f:
        data = f.read()
    return fal_client.upload(data, content_type)


# ─── Agent 1 ──────────────────────────────────────────────────────────────────

def _run_agent1(image_url: str) -> ImageAnalysisOutput | None:
    """
    Call Agent 1 (vision) for a single image. Returns parsed output or None on
    unrecoverable failure. Retries once on JSON/validation parse failure.
    """
    for attempt in range(1, 3):
        try:
            raw = _call_vision_api(
                image_urls=[image_url],
                system_prompt=AGENT1_SYSTEM_PROMPT,
                user_prompt=AGENT1_USER_PROMPT,
            )
            data = _parse_json_output(raw)
            return ImageAnalysisOutput.model_validate(data)
        except (json.JSONDecodeError, ValidationError) as exc:
            if attempt == 1:
                logger.warning(
                    "fingerprint.agent1_parse_failed attempt=%d, retrying: %s", attempt, exc
                )
                continue
            logger.error("fingerprint.agent1_parse_failed_final: %s", exc)
            return None
        except Exception as exc:
            logger.error("fingerprint.agent1_api_error: %s", exc)
            return None
    return None


def _analyze_gallery_worker(static_id: int):
    """
    Background worker — Agent 1 for a WinningStatic (gallery) image.
    Triggered after a new WinningStatic is saved.
    """
    try:
        from apps.brand_kit.models import WinningStatic

        static = WinningStatic.objects.get(id=static_id)

        # Skip if already analyzed (e.g., duplicate trigger)
        if ImageAnalysisRecord.objects.filter(winning_static_id=static_id).exists():
            return

        image_url = _upload_local_file(static.file.path)
        analysis = _run_agent1(image_url)
        if analysis is None:
            return

        ImageAnalysisRecord.objects.create(
            workspace_id=static.workspace_id,
            image_url=image_url,
            source=ImageAnalysisRecord.SOURCE_GALLERY,
            winning_static_id=static_id,
            rating=None,  # gallery uploads have no user rating
            analysis=analysis.model_dump(mode="json"),
        )
        logger.info("fingerprint.agent1_gallery_done static_id=%s", static_id)
        _maybe_trigger_merge(static.workspace_id)

    except Exception as exc:
        logger.error("fingerprint.agent1_gallery_failed static_id=%s: %s", static_id, exc)


def _analyze_generation_worker(creative_id, workspace_id):
    """
    Background worker — Agent 1 for a GeneratedCreative (rated generation).
    Triggered when a creative's rating is set or updated.

    - If no existing record: run Agent 1 vision call, create record.
    - If record exists: just update the rating (image analysis doesn't change).
    """
    try:
        from apps.creatives.models import GeneratedCreative

        creative = GeneratedCreative.objects.get(id=creative_id)

        existing = ImageAnalysisRecord.objects.filter(creative_id=creative_id).first()
        if existing:
            # Rating updated — refresh stored value, re-derive sentiment
            existing.rating = creative.rating
            existing.save(update_fields=["rating", "sentiment"])
            logger.info(
                "fingerprint.agent1_rating_updated creative_id=%s rating=%s",
                creative_id,
                creative.rating,
            )
            return

        if not creative.image_url:
            return

        analysis = _run_agent1(creative.image_url)
        if analysis is None:
            return

        ImageAnalysisRecord.objects.create(
            workspace_id=workspace_id,
            image_url=creative.image_url,
            source=ImageAnalysisRecord.SOURCE_GENERATION,
            creative_id=creative_id,
            rating=creative.rating,
            analysis=analysis.model_dump(mode="json"),
        )
        logger.info("fingerprint.agent1_generation_done creative_id=%s", creative_id)
        _maybe_trigger_merge(workspace_id)

    except Exception as exc:
        logger.error(
            "fingerprint.agent1_generation_failed creative_id=%s: %s", creative_id, exc
        )


# ─── Agent 1 public entry points ──────────────────────────────────────────────

def trigger_analyze_gallery(static_id: int):
    """Fire-and-forget: analyze a gallery WinningStatic in background."""
    threading.Thread(
        target=_analyze_gallery_worker,
        args=(static_id,),
        daemon=True,
    ).start()


def trigger_analyze_generation(creative_id, workspace_id):
    """Fire-and-forget: analyze or update a rated GeneratedCreative in background."""
    threading.Thread(
        target=_analyze_generation_worker,
        args=(creative_id, workspace_id),
        daemon=True,
    ).start()


# ─── Promo text extraction ────────────────────────────────────────────────────

_PROMO_DESCRIPTION_NOISE = (
    'displayed as', 'acting as', 'rendered as', 'shown as', 'appears as',
    'figure displayed', 'badge itself', 'functions as', 'large 3d', 'glossy text',
    'promotional badge', 'as the badge',
)


def _extract_promo_text_worker(promo_id: int):
    """
    Extract verbatim promotional text from a Brand Kit Promo image.

    Uses a dedicated strict extraction prompt (not the general Agent 1 schema)
    to avoid getting visual descriptions instead of actual text.
    Stores results on Promo.extracted_text.
    """
    try:
        from apps.brand_kit.models import Promo
        promo = Promo.objects.get(id=promo_id)

        # Upload local file to fal CDN for vision access
        image_url = _upload_local_file(promo.file.path)

        # Use dedicated strict extraction prompt — returns {"texts": [...]}
        raw = _call_vision_api(
            [image_url],
            PROMO_TEXT_EXTRACT_SYSTEM_PROMPT,
            PROMO_TEXT_EXTRACT_USER_PROMPT,
        )
        try:
            data = _parse_json_output(raw)
            raw_texts = data.get('texts') or []
        except Exception:
            raw_texts = []

        # Filter: skip legal/disclaimer text and any segment that snuck in
        # a description of how text looks instead of the text itself.
        skip_phrases = ('18+', '21+', 'terms', 'conditions', 'responsible', 'void', 'no purchase')
        parts = []
        seen_upper = set()
        for t in raw_texts:
            t = t.strip()
            if not t or len(t) < 2:
                continue
            tl = t.lower()
            if any(s in tl for s in skip_phrases):
                continue
            if any(noise in tl for noise in _PROMO_DESCRIPTION_NOISE):
                # The model described instead of transcribed — skip this segment
                logger.warning(
                    "fingerprint.promo_extract_noise_skipped promo_id=%s text=%r", promo_id, t
                )
                continue
            key = t.upper()
            if key not in seen_upper:
                seen_upper.add(key)
                parts.append(t)

        promo.extracted_text = ' | '.join(parts)
        promo.extraction_status = 'done'
        promo.save(update_fields=['extracted_text', 'extraction_status'])
        logger.info("fingerprint.promo_text_extracted promo_id=%s text=%r", promo_id, promo.extracted_text)

    except Exception as exc:
        logger.error("fingerprint.promo_text_extraction_failed promo_id=%s: %s", promo_id, exc)
        try:
            from apps.brand_kit.models import Promo
            Promo.objects.filter(id=promo_id).update(extraction_status='error')
        except Exception:
            pass


def trigger_extract_promo_text(promo_id: int):
    """Fire-and-forget: extract verbatim text from a Brand Kit promo image."""
    threading.Thread(target=_extract_promo_text_worker, args=(promo_id,), daemon=True).start()


# ─── Agent 2 ──────────────────────────────────────────────────────────────────

def _collect_brand_kit(workspace_id):
    """
    Aggregate brand kit assets for a workspace across all brand_kit models.
    Returns (image_urls, image_order_description, color_hex_list, font_heading, font_body)
    or None if no logo is found (Agent 2 cannot run without a logo).
    """
    from apps.brand_kit.models import Cta, Logo, PalettePreset, Promo, TypographyPreset

    # Logo — prefer is_primary=True, fall back to most recent
    logo = (
        Logo.objects.filter(workspace_id=workspace_id, is_primary=True)
        .order_by("-uploaded_at")
        .first()
    )
    if not logo:
        logo = (
            Logo.objects.filter(workspace_id=workspace_id)
            .order_by("-uploaded_at")
            .first()
        )
    if not logo:
        logger.warning(
            "fingerprint.agent2_skipped_no_logo workspace_id=%s", workspace_id
        )
        return None

    # Active palette
    palette = (
        PalettePreset.objects.filter(workspace_id=workspace_id, active=True)
        .order_by("-created_at")
        .first()
    )
    color_hex_list = (
        ", ".join(str(c) for c in (palette.colors or [])) if palette else "not specified"
    )

    # Active typography
    typo = (
        TypographyPreset.objects.filter(workspace_id=workspace_id, active=True)
        .order_by("-created_at")
        .first()
    )
    font_heading = typo.heading if typo else "not specified"
    font_body = typo.body if typo else "not specified"

    # CTAs and Promos — most recent 3 each
    ctas = list(Cta.objects.filter(workspace_id=workspace_id).order_by("-uploaded_at")[:3])
    promos = list(Promo.objects.filter(workspace_id=workspace_id).order_by("-uploaded_at")[:3])

    # Upload all local files to fal CDN to get public URLs
    _set_fal_key()

    image_urls = []
    image_labels = []

    logo_url = _upload_local_file(logo.file.path)
    image_urls.append(logo_url)
    logo_name = logo.name or "unnamed"
    image_labels.append(f'Image 1: PRIMARY LOGO — "{logo_name}"')

    idx = 2
    for cta in ctas:
        try:
            cta_url = _upload_local_file(cta.file.path)
            image_urls.append(cta_url)
            cta_name = cta.name or "unnamed"
            image_labels.append(
                f'Image {idx}: CTA (call-to-action graphic) — "{cta_name}"'
            )
            idx += 1
        except Exception as exc:
            logger.warning("fingerprint.agent2_cta_upload_failed: %s", exc)

    for promo in promos:
        try:
            promo_url = _upload_local_file(promo.file.path)
            image_urls.append(promo_url)
            promo_name = promo.name or "unnamed"
            image_labels.append(
                f'Image {idx}: PROMO (promotional graphic) — "{promo_name}"'
            )
            idx += 1
        except Exception as exc:
            logger.warning("fingerprint.agent2_promo_upload_failed: %s", exc)

    image_order_description = "\n".join(image_labels)

    return image_urls, image_order_description, color_hex_list, font_heading, font_body


def _run_agent2(workspace_id) -> BrandProfileOutput | None:
    """
    Call Agent 2 (vision) with the full brand kit for a workspace.
    Returns parsed output or None on failure.
    """
    kit = _collect_brand_kit(workspace_id)
    if kit is None:
        return None

    image_urls, image_order_description, color_hex_list, font_heading, font_body = kit

    user_prompt = AGENT2_USER_PROMPT_TEMPLATE.format(
        image_order_description=image_order_description,
        color_hex_list=color_hex_list,
        font_heading=font_heading,
        font_body=font_body,
    )

    for attempt in range(1, 3):
        try:
            raw = _call_vision_api(
                image_urls=image_urls,
                system_prompt=AGENT2_SYSTEM_PROMPT,
                user_prompt=user_prompt,
            )
            data = _parse_json_output(raw)
            return BrandProfileOutput.model_validate(data)
        except (json.JSONDecodeError, ValidationError) as exc:
            if attempt == 1:
                logger.warning(
                    "fingerprint.agent2_parse_failed attempt=%d, retrying: %s", attempt, exc
                )
                continue
            logger.error("fingerprint.agent2_parse_failed_final: %s", exc)
            return None
        except Exception as exc:
            logger.error("fingerprint.agent2_api_error: %s", exc)
            return None
    return None


def _analyze_brand_kit_worker(workspace_id):
    """
    Background worker — Agent 2 for a workspace's brand kit.
    Creates BrandFingerprint if it doesn't exist; updates brand_profile.
    """
    try:
        result = _run_agent2(workspace_id)
        if result is None:
            return

        fp, _ = BrandFingerprint.objects.get_or_create(workspace_id=workspace_id)
        fp.brand_profile = result.model_dump(mode="json")
        fp.brand_profile_version += 1
        fp.save(update_fields=["brand_profile", "brand_profile_version", "updated_at"])
        logger.info(
            "fingerprint.agent2_done workspace_id=%s version=%d",
            workspace_id,
            fp.brand_profile_version,
        )

    except Exception as exc:
        logger.error(
            "fingerprint.agent2_worker_failed workspace_id=%s: %s", workspace_id, exc
        )


# ─── Agent 2 public entry point ───────────────────────────────────────────────

def trigger_analyze_brand_kit(workspace_id):
    """Fire-and-forget: re-analyze the brand kit for a workspace in background."""
    threading.Thread(
        target=_analyze_brand_kit_worker,
        args=(workspace_id,),
        daemon=True,
    ).start()


# ─── Text-only API call (Agent 4, Synthesis, Agent 3) ─────────────────────────

def _call_text_api(system_prompt: str, user_prompt: str) -> str:
    """
    Call fal.ai OpenRouter text-only endpoint (no images).
    Returns the raw `output` string. Raises on API failure.
    """
    _set_fal_key()
    result = fal_client.subscribe(
        "openrouter/router/enterprise",
        arguments={
            "system_prompt": system_prompt,
            "prompt": user_prompt,
            "model": "anthropic/claude-sonnet-5",
            "enable_web_search": False,
            "temperature": 0.2,
        },
    )
    return result["output"]


# ─── Agent 4: Merge ───────────────────────────────────────────────────────────

def _run_agent4(workspace_id) -> tuple[MergeOutput, list[int]] | None:
    """
    Run incremental merge for a workspace.
    Returns (MergeOutput, list_of_merged_record_ids) or None on failure.
    """
    try:
        fp = BrandFingerprint.objects.get(workspace_id=workspace_id)
    except BrandFingerprint.DoesNotExist:
        logger.warning("fingerprint.agent4_no_fingerprint workspace_id=%s", workspace_id)
        return None

    new_records = list(
        ImageAnalysisRecord.objects.filter(
            workspace_id=workspace_id,
            included_in_fingerprint_version__isnull=True,
        ).values("id", "analysis", "rating")
    )

    if not new_records:
        logger.info("fingerprint.agent4_nothing_new workspace_id=%s", workspace_id)
        return None

    new_ids = [r["id"] for r in new_records]

    current_fp = {
        "visual_dna": fp.visual_dna,
        "negative_patterns": fp.negative_patterns,
        "confidence": fp.confidence,
        "based_on_image_count": fp.based_on_image_count,
    }
    new_payload = [{"analysis": r["analysis"], "rating": r["rating"]} for r in new_records]

    user_prompt = AGENT4_USER_PROMPT_TEMPLATE.format(
        last_updated=fp.updated_at.isoformat(),
        current_fingerprint_json=json.dumps(current_fp, ensure_ascii=False),
        count=len(new_records),
        new_records_json=json.dumps(new_payload, ensure_ascii=False),
    )

    for attempt in range(1, 3):
        try:
            raw = _call_text_api(AGENT4_SYSTEM_PROMPT, user_prompt)
            data = _parse_json_output(raw)
            result = MergeOutput.model_validate(data)
            return result, new_ids
        except (json.JSONDecodeError, ValidationError) as exc:
            if attempt == 1:
                logger.warning("fingerprint.agent4_parse_failed attempt=%d, retrying: %s", attempt, exc)
                continue
            logger.error("fingerprint.agent4_parse_failed_final: %s", exc)
            return None
        except Exception as exc:
            logger.error("fingerprint.agent4_api_error: %s", exc)
            return None
    return None


def _merge_worker(workspace_id):
    """
    Background worker — Agent 4 incremental merge.
    Updates visual_dna + negative_patterns in BrandFingerprint.
    Triggers Synthesis if drift_flag is set.
    """
    try:
        outcome = _run_agent4(workspace_id)
        if outcome is None:
            return

        result, new_ids = outcome

        with transaction.atomic():
            fp = BrandFingerprint.objects.select_for_update().get(workspace_id=workspace_id)
            fp.visual_dna = result.visual_dna.model_dump(mode="json")
            fp.negative_patterns = result.negative_patterns.model_dump(mode="json")
            fp.confidence = result.confidence
            fp.based_on_image_count += len(new_ids)
            fp.visual_dna_version += 1
            fp.save()
            ImageAnalysisRecord.objects.filter(id__in=new_ids).update(
                included_in_fingerprint_version=fp.visual_dna_version
            )

        logger.info(
            "fingerprint.agent4_done workspace_id=%s version=%d merged=%d drift=%s changelog=%s",
            workspace_id, fp.visual_dna_version, len(new_ids),
            result.drift_flag, result.changelog[:80],
        )

        if result.drift_flag:
            logger.info("fingerprint.agent4_drift_detected — triggering full recreate")
            trigger_synthesis(workspace_id, reason="drift_flag")

    except Exception as exc:
        logger.error("fingerprint.agent4_worker_failed workspace_id=%s: %s", workspace_id, exc)


# ─── Synthesis: Full Recreate ─────────────────────────────────────────────────

def _run_synthesis(workspace_id) -> SynthesisOutput | None:
    """
    Run full recreate for a workspace — reads entire corpus.
    Returns SynthesisOutput or None on failure.
    """
    records = list(
        ImageAnalysisRecord.objects.filter(workspace_id=workspace_id)
        .values("analysis", "rating")
    )

    if not records:
        logger.warning("fingerprint.synthesis_empty_corpus workspace_id=%s", workspace_id)
        return None

    corpus_payload = [{"analysis": r["analysis"], "rating": r["rating"]} for r in records]

    user_prompt = SYNTHESIS_USER_PROMPT_TEMPLATE.format(
        count=len(records),
        corpus_json=json.dumps(corpus_payload, ensure_ascii=False),
    )

    for attempt in range(1, 3):
        try:
            raw = _call_text_api(SYNTHESIS_SYSTEM_PROMPT, user_prompt)
            data = _parse_json_output(raw)
            return SynthesisOutput.model_validate(data)
        except (json.JSONDecodeError, ValidationError) as exc:
            if attempt == 1:
                logger.warning("fingerprint.synthesis_parse_failed attempt=%d, retrying: %s", attempt, exc)
                continue
            logger.error("fingerprint.synthesis_parse_failed_final: %s", exc)
            return None
        except Exception as exc:
            logger.error("fingerprint.synthesis_api_error: %s", exc)
            return None
    return None


def _synthesis_worker(workspace_id, reason="manual"):
    """
    Background worker — full recreate from entire corpus.
    Rewrites visual_dna + negative_patterns from scratch and resets delta markers.
    """
    try:
        result = _run_synthesis(workspace_id)
        if result is None:
            return

        with transaction.atomic():
            fp, _ = BrandFingerprint.objects.select_for_update().get_or_create(workspace_id=workspace_id)
            fp.visual_dna = result.visual_dna.model_dump(mode="json")
            fp.negative_patterns = result.negative_patterns.model_dump(mode="json")
            fp.confidence = result.confidence
            fp.based_on_image_count = result.based_on_image_count
            fp.visual_dna_version += 1
            fp.save()
            # Mark all corpus records as included in this version
            ImageAnalysisRecord.objects.filter(workspace_id=workspace_id).update(
                included_in_fingerprint_version=fp.visual_dna_version
            )

        logger.info(
            "fingerprint.synthesis_done workspace_id=%s reason=%s version=%d count=%d confidence=%s",
            workspace_id, reason, fp.visual_dna_version,
            result.based_on_image_count, result.confidence,
        )

    except Exception as exc:
        logger.error(
            "fingerprint.synthesis_worker_failed workspace_id=%s reason=%s: %s",
            workspace_id, reason, exc,
        )


# ─── Merge trigger logic ──────────────────────────────────────────────────────

def _maybe_trigger_merge(workspace_id):
    """
    Called after every Agent 1 completion. Decides whether to kick off
    Agent 4 merge based on:
      1. First-time merge: visual_dna_version == 0 and FIRST_MERGE_THRESHOLD records ready
      2. Volume threshold: VOLUME_THRESHOLD unmerged records
      3. 24h since last merge: at least 1 unmerged record exists
    Never raises — failure is logged and silently ignored.
    """
    try:
        from django.utils import timezone
        from datetime import timedelta

        fp = BrandFingerprint.objects.filter(workspace_id=workspace_id).first()
        if fp is None:
            return  # no fingerprint yet (Agent 2 hasn't run) — skip

        unmerged = ImageAnalysisRecord.objects.filter(
            workspace_id=workspace_id,
            included_in_fingerprint_version__isnull=True,
        ).count()

        if unmerged == 0:
            return

        # Rule 1: first merge ever — don't wait 24h
        if fp.visual_dna_version == 0 and unmerged >= FIRST_MERGE_THRESHOLD:
            logger.info("fingerprint.merge_trigger=first_merge workspace_id=%s unmerged=%d", workspace_id, unmerged)
            trigger_merge(workspace_id)
            return

        # Rule 2: volume burst
        if unmerged >= VOLUME_THRESHOLD:
            logger.info("fingerprint.merge_trigger=volume workspace_id=%s unmerged=%d", workspace_id, unmerged)
            trigger_merge(workspace_id)
            return

        # Rule 3: 24h since last visual_dna update
        if fp.visual_dna_version > 0:
            cutoff = timezone.now() - timedelta(hours=24)
            if fp.updated_at < cutoff:
                logger.info("fingerprint.merge_trigger=24h workspace_id=%s", workspace_id)
                trigger_merge(workspace_id)

    except Exception as exc:
        logger.error("fingerprint._maybe_trigger_merge failed workspace_id=%s: %s", workspace_id, exc)


# ─── Agent 4 + Synthesis public entry points ──────────────────────────────────

def trigger_merge(workspace_id):
    """Fire-and-forget: run Agent 4 incremental merge in background."""
    threading.Thread(
        target=_merge_worker,
        args=(workspace_id,),
        daemon=True,
    ).start()


def trigger_synthesis(workspace_id, reason="manual"):
    """Fire-and-forget: run full Synthesis recreate in background."""
    threading.Thread(
        target=_synthesis_worker,
        args=(workspace_id, reason),
        daemon=True,
    ).start()


# ─── Agent 3: Prompt Enhancement (synchronous) ────────────────────────────────

def enhance_prompt_with_fingerprint(
    workspace_id,
    draft_prompt: str,
    user_brief: str = "",
) -> tuple[str, str] | None:
    """
    Synchronously enhance a draft T2I prompt using the workspace's brand
    fingerprint (Agent 3). Returns (enhanced_prompt, negative_prompt) or None
    if no fingerprint exists, fingerprint has no visual_dna yet, or the call fails.

    Designed to be called inline in the generation worker — must not raise.
    """
    try:
        fp = BrandFingerprint.objects.filter(workspace_id=workspace_id).first()
        if not fp or not fp.visual_dna:
            logger.info(
                "fingerprint.agent3_skipped workspace_id=%s reason=no_fingerprint", workspace_id
            )
            return None

        fingerprint_payload = {
            "brand_profile": fp.brand_profile or {},
            "visual_dna": fp.visual_dna or {},
            "negative_patterns": fp.negative_patterns or {},
            "confidence": fp.confidence,
        }

        user_prompt = AGENT3_USER_PROMPT_TEMPLATE.format(
            fingerprint_json=json.dumps(fingerprint_payload, ensure_ascii=False),
            draft_prompt=draft_prompt,
            user_brief=user_brief.strip() if user_brief else "(none)",
        )

        raw = _call_text_api(AGENT3_SYSTEM_PROMPT, user_prompt)
        data = _parse_json_output(raw)
        result = PromptGenerationOutput.model_validate(data)

        logger.info(
            "fingerprint.agent3_done workspace_id=%s notes=%s",
            workspace_id, result.notes[:120],
        )
        return result.prompt, result.negative_prompt

    except (json.JSONDecodeError, ValidationError) as exc:
        logger.warning("fingerprint.agent3_parse_failed workspace_id=%s: %s", workspace_id, exc)
        return None
    except Exception as exc:
        logger.error("fingerprint.agent3_failed workspace_id=%s: %s", workspace_id, exc)
        return None


# ─── Campaign Intelligence helpers ────────────────────────────────────────────

def _call_vision_web_search_api(image_urls: list, system_prompt: str, user_prompt: str) -> str:
    """Vision endpoint + web search — Market Analyst (sees brand images while researching)."""
    _set_fal_key()
    result = fal_client.subscribe(
        "openrouter/router/vision",
        arguments={
            "image_urls"      : image_urls,
            "system_prompt"   : system_prompt,
            "prompt"          : user_prompt,
            "model"           : "anthropic/claude-sonnet-5",
            "enable_web_search": True,
            "temperature"     : 0.3,
        },
    )
    return result["output"]


def _call_vision_creative_api(image_urls: list, system_prompt: str, user_prompt: str) -> str:
    """Vision endpoint, no web search, higher temperature — Creative Director."""
    _set_fal_key()
    result = fal_client.subscribe(
        "openrouter/router/vision",
        arguments={
            "image_urls"      : image_urls,
            "system_prompt"   : system_prompt,
            "prompt"          : user_prompt,
            "model"           : "anthropic/claude-sonnet-5",
            "enable_web_search": False,
            "temperature"     : 0.7,
        },
    )
    return result["output"]


def _get_brand_cta_examples(workspace, max_count: int = 8) -> list:
    """Return distinct CTA text strings found in the workspace's analysed image corpus."""
    records = (
        ImageAnalysisRecord.objects
        .filter(workspace=workspace)
        .order_by('-rating', '-created_at')
        .values_list('analysis', flat=True)[:50]
    )
    seen, ctas = set(), []
    for analysis in records:
        if not analysis:
            continue
        cta_text = (analysis.get('branding_elements') or {}).get('cta_text') or ''
        # Split compound CTAs like "CLAIM NOW / LEARN MORE" into individual items
        for part in re.split(r'\s*[/|,]\s*', cta_text):
            part = part.strip().strip('»').strip()
            if part and part.upper() not in seen and len(part) < 50:
                seen.add(part.upper())
                ctas.append(part)
                if len(ctas) >= max_count:
                    return ctas
    return ctas


def _get_brand_image_urls(workspace, max_count: int = 8) -> list:
    """Return up to max_count distinct image URLs from the workspace fingerprint corpus,
    ordered by rating desc then recency desc (best images first)."""
    raw = (
        ImageAnalysisRecord.objects
        .filter(workspace=workspace)
        .order_by('-rating', '-created_at')
        .values_list('image_url', flat=True)[:max_count * 2]
    )
    seen, urls = set(), []
    for url in raw:
        if url and url not in seen:
            seen.add(url)
            urls.append(url)
            if len(urls) >= max_count:
                break
    return urls


# ─── Agent 1: Market Analyst ──────────────────────────────────────────────────

def _run_market_analyst(campaign):
    """Synchronous Agent 1 call. Returns MarketInsightOutput or None."""
    from .prompts import MARKET_ANALYST_SYSTEM_PROMPT, MARKET_ANALYST_USER_PROMPT_TEMPLATE
    from .schemas import MarketInsightOutput

    fp = BrandFingerprint.objects.filter(workspace=campaign.workspace).first()
    brand_tone = ", ".join(fp.brand_profile.get("brand_tone_keywords", [])[:5]) if fp else "not specified"

    user_prompt = MARKET_ANALYST_USER_PROMPT_TEMPLATE.format(
        target_audience=campaign.target_audience or "general adult iGaming audience",
        target_region  =campaign.target_region   or "global",
        objective      =campaign.get_objective_display() or "general campaign",
        campaign_brief =campaign.campaign_brief   or "none provided",
        brand_tone     =brand_tone,
    )

    brand_images = _get_brand_image_urls(campaign.workspace, max_count=6)
    image_note = (
        f"\n\nVISUAL CONTEXT: You are shown {len(brand_images)} of this brand's actual advertising creatives. "
        "Study them carefully before searching — understand their current art style, color palette, composition patterns, and hero elements. "
        "When describing what competitors do differently or what is trending, explicitly contrast against what you see in these brand images."
        if brand_images else ""
    )
    system_with_context = MARKET_ANALYST_SYSTEM_PROMPT + image_note

    for attempt in range(1, 3):
        try:
            if brand_images:
                raw = _call_vision_web_search_api(brand_images, system_with_context, user_prompt)
            else:
                # Fallback: no brand images yet — plain web search
                raw = _call_vision_web_search_api([], system_with_context, user_prompt)
            data = _parse_json_output(raw)
            return MarketInsightOutput.model_validate(data)
        except (json.JSONDecodeError, ValidationError) as exc:
            if attempt == 1:
                logger.warning("campaign_intel.agent1_parse_retry: %s", exc)
                continue
            logger.error("campaign_intel.agent1_parse_failed: %s", exc)
            return None
        except Exception as exc:
            logger.error("campaign_intel.agent1_api_error: %s", exc)
            return None
    return None


def _market_research_worker(campaign_id):
    """Background thread: run Agent 1, save result, auto-trigger Agent 2."""
    from django.db import connection
    from apps.brand_kit.models import Campaign
    from .models import CampaignMarketInsight

    connection.close()
    try:
        campaign = Campaign.objects.select_related('workspace').get(id=campaign_id)
        insight, _ = CampaignMarketInsight.objects.get_or_create(
            campaign=campaign,
            defaults={'workspace': campaign.workspace},
        )
        insight.status = 'pending'
        insight.save(update_fields=['status', 'updated_at'])

        result = _run_market_analyst(campaign)
        if result:
            insight.report = result.model_dump(mode='json')
            insight.status = 'ready'
            insight.error  = ''
        else:
            insight.status = 'failed'
            insight.error  = 'Agent 1 (Market Analyst) returned no output'
        insight.save()

        # Auto-trigger Creative Director when fingerprint has visual_dna
        if result:
            fp = BrandFingerprint.objects.filter(workspace=campaign.workspace).first()
            if fp and fp.visual_dna:
                trigger_creative_director(campaign_id)
            else:
                logger.info("campaign_intel.skip_agent2_no_fingerprint campaign_id=%s", campaign_id)

    except Exception as exc:
        logger.error("campaign_intel.market_research_worker_failed campaign_id=%s: %s", campaign_id, exc)
    finally:
        from django.db import connection as _conn
        _conn.close()


def trigger_market_research(campaign_id):
    """Fire-and-forget: start Agent 1 in a background thread."""
    threading.Thread(target=_market_research_worker, args=(campaign_id,), daemon=True).start()


# ─── Agent 2: Creative Director ───────────────────────────────────────────────

def _run_creative_director(campaign, insight):
    """Synchronous Agent 2 call. Returns CreativeBriefOutput or None."""
    from .prompts import CREATIVE_DIRECTOR_SYSTEM_PROMPT, CREATIVE_DIRECTOR_USER_PROMPT_TEMPLATE
    from .schemas import CreativeBriefOutput

    fp = BrandFingerprint.objects.filter(workspace=campaign.workspace).first()

    cta_examples = _get_brand_cta_examples(campaign.workspace)
    cta_examples_text = (
        ', '.join(f'"{c}"' for c in cta_examples)
        if cta_examples
        else '"PLAY NOW", "SPIN FREE", "CLAIM BONUS"'
    )

    user_prompt = CREATIVE_DIRECTOR_USER_PROMPT_TEMPLATE.format(
        target_audience      =campaign.target_audience or "general",
        target_region        =campaign.target_region   or "global",
        objective            =campaign.get_objective_display() or "general",
        campaign_brief       =campaign.campaign_brief  or "none provided",
        cta_examples         =cta_examples_text,
        market_research_json =json.dumps(insight.report, ensure_ascii=False),
        visual_dna_json      =json.dumps(fp.visual_dna        if fp else {}, ensure_ascii=False),
        brand_profile_json   =json.dumps(fp.brand_profile     if fp else {}, ensure_ascii=False),
        negative_patterns_json=json.dumps(fp.negative_patterns if fp else {}, ensure_ascii=False),
    )

    brand_images = _get_brand_image_urls(campaign.workspace, max_count=8)
    image_note = (
        f"\n\nVISUAL SAMPLES: You are shown {len(brand_images)} of this brand's actual advertising creatives. "
        "These are the images the Visual DNA JSON was extracted from. "
        "Cross-reference what you see directly with the DNA text — trust your eyes over the description where they differ. "
        "For 'on-brand' briefs, write extra_prompt referencing specific visual elements you can see. "
        "For 'the-bet' briefs, explicitly describe what to do DIFFERENTLY from these images."
        if brand_images else ""
    )
    system_with_context = CREATIVE_DIRECTOR_SYSTEM_PROMPT + image_note

    for attempt in range(1, 3):
        try:
            raw  = _call_vision_creative_api(brand_images, system_with_context, user_prompt)
            data = _parse_json_output(raw)
            return CreativeBriefOutput.model_validate(data)
        except (json.JSONDecodeError, ValidationError) as exc:
            if attempt == 1:
                logger.warning("campaign_intel.agent2_parse_retry: %s", exc)
                continue
            logger.error("campaign_intel.agent2_parse_failed: %s", exc)
            return None
        except Exception as exc:
            logger.error("campaign_intel.agent2_api_error: %s", exc)
            return None
    return None


def _creative_director_worker(campaign_id):
    """Background thread: run Agent 2, save briefs."""
    from django.db import connection
    from apps.brand_kit.models import Campaign
    from .models import CampaignMarketInsight, CampaignCreativeBrief

    connection.close()
    try:
        campaign = Campaign.objects.select_related('workspace').get(id=campaign_id)
        insight  = CampaignMarketInsight.objects.filter(campaign=campaign, status='ready').first()
        if not insight:
            logger.warning("campaign_intel.no_ready_insight campaign_id=%s", campaign_id)
            return

        fp         = BrandFingerprint.objects.filter(workspace=campaign.workspace).first()
        fp_version = fp.visual_dna_version if fp else 0

        brief_obj = CampaignCreativeBrief.objects.create(
            campaign=campaign,
            workspace=campaign.workspace,
            market_insight=insight,
            fingerprint_version=fp_version,
            status='pending',
        )

        result = _run_creative_director(campaign, insight)
        if result:
            brief_obj.briefs = [b.model_dump(mode='json') for b in result.briefs]
            brief_obj.status = 'ready'
            brief_obj.error  = ''
        else:
            brief_obj.status = 'failed'
            brief_obj.error  = 'Agent 2 (Creative Director) returned no output'
        brief_obj.save()
        logger.info("campaign_intel.agent2_done campaign_id=%s briefs=%d", campaign_id, len(brief_obj.briefs))

    except Exception as exc:
        logger.error("campaign_intel.creative_director_worker_failed campaign_id=%s: %s", campaign_id, exc)
    finally:
        from django.db import connection as _conn
        _conn.close()


def trigger_creative_director(campaign_id):
    """Fire-and-forget: start Agent 2 in a background thread."""
    threading.Thread(target=_creative_director_worker, args=(campaign_id,), daemon=True).start()


# ─── Trend Scout: Daily iGaming Creative Trend Agent ─────────────────────────

def _run_trend_scout(workspace, trend_brief):
    """Run the Trend Scout web-search agent and return a dict with landscape_summary + ideas list."""
    from datetime import date
    from pydantic import BaseModel, ValidationError

    today = date.today()
    month_year = today.strftime('%B %Y')

    from .prompts import TREND_SCOUT_SYSTEM_PROMPT, TREND_SCOUT_USER_PROMPT_TEMPLATE

    user_prompt = TREND_SCOUT_USER_PROMPT_TEMPLATE.format(
        today=today.isoformat(),
        workspace_name=workspace.name,
        month_year=month_year,
    )

    # Schema for structured output
    class TrendIdeaItem(BaseModel):
        id: str
        theme: str
        concept: str
        visual_direction: str
        extra_prompt: str
        trend_insight: str

    class TrendScoutOutput(BaseModel):
        landscape_summary: str
        ideas: list

    raw = _call_vision_web_search_api(
        image_urls=[],          # no brand images needed — pure trend research
        system_prompt=TREND_SCOUT_SYSTEM_PROMPT,
        user_prompt=user_prompt,
    )

    for attempt in range(2):
        try:
            data = _parse_json_output(raw)
            validated = TrendScoutOutput.model_validate(data)
            # Validate each idea loosely — just ensure required keys exist
            ideas = []
            for idea in (validated.ideas or []):
                if isinstance(idea, dict):
                    item = idea
                else:
                    item = idea.model_dump() if hasattr(idea, 'model_dump') else dict(idea)
                # Ensure required fields are present
                for field in ('id', 'theme', 'concept', 'visual_direction', 'extra_prompt', 'trend_insight'):
                    if field not in item:
                        item[field] = ''
                ideas.append(item)
            return {'landscape_summary': validated.landscape_summary, 'ideas': ideas}
        except (json.JSONDecodeError, ValidationError) as exc:
            if attempt == 0:
                logger.warning("trend_scout.parse_retry: %s", exc)
                # Re-call once with a stricter reminder
                raw = _call_vision_web_search_api(
                    image_urls=[],
                    system_prompt=TREND_SCOUT_SYSTEM_PROMPT,
                    user_prompt=user_prompt + '\n\nReturn ONLY valid JSON — no markdown fences, no prose.',
                )
                continue
            logger.error("trend_scout.parse_failed: %s", exc)
            return None
        except Exception as exc:
            logger.error("trend_scout.api_error: %s", exc)
            return None
    return None


def _trend_scout_worker(trend_brief_id):
    """Background thread: run Trend Scout agent, save ideas to WorkspaceTrendBrief."""
    from django.db import connection
    from .models import WorkspaceTrendBrief

    connection.close()
    try:
        brief = WorkspaceTrendBrief.objects.select_related('workspace').get(id=trend_brief_id)
        result = _run_trend_scout(brief.workspace, brief)
        if result and result.get('ideas'):
            brief.ideas = result['ideas']
            brief.landscape_summary = result.get('landscape_summary', '')
            brief.status = 'ready'
            brief.error = ''
        else:
            brief.status = 'failed'
            brief.error = 'Trend Scout returned no output'
        brief.save()
        logger.info("trend_scout.done workspace_id=%s ideas=%d", brief.workspace_id, len(brief.ideas))
    except Exception as exc:
        logger.error("trend_scout.worker_failed trend_brief_id=%s: %s", trend_brief_id, exc)
    finally:
        from django.db import connection as _conn
        _conn.close()


def trigger_trend_scout(workspace):
    """Create a fresh WorkspaceTrendBrief and run the scout in a background thread.
    
    Returns the newly created WorkspaceTrendBrief instance (status='pending').
    """
    from .models import WorkspaceTrendBrief
    brief = WorkspaceTrendBrief.objects.create(workspace=workspace, status='pending')
    threading.Thread(target=_trend_scout_worker, args=(brief.id,), daemon=True).start()
    return brief


# ─── Corpus text helpers ─────────────────────────────────────────────────────

def _get_corpus_text_examples(workspace, max_headlines=5, max_promos=4):
    """Extract real headline and promo text examples from the workspace corpus.

    Returns (headlines: list[str], promos: list[str]).
    Source: ImageAnalysisRecord.analysis.typography_in_image.{headline_text, body_text}
    """
    records = (
        ImageAnalysisRecord.objects
        .filter(workspace=workspace)
        .order_by('-rating', '-created_at')
        .values_list('analysis', flat=True)[:40]
    )
    headlines, promos = [], []
    seen_h, seen_p = set(), set()
    for analysis in records:
        if not analysis:
            continue
        typo = analysis.get('typography_in_image') or {}
        h = (typo.get('headline_text') or '').strip()
        b = (typo.get('body_text') or '').strip()
        # Exclude pure disclaimer text and very short fragments
        if (h and len(h) > 5 and len(h) < 80
                and '21+' not in h and 'no purchase' not in h.lower()
                and h.upper() not in seen_h):
            seen_h.add(h.upper())
            headlines.append(h)
        if (b and len(b) > 5 and len(b) < 80
                and '21+' not in b and 'no purchase' not in b.lower()
                and b.upper() not in seen_p):
            seen_p.add(b.upper())
            promos.append(b)
        if len(headlines) >= max_headlines and len(promos) >= max_promos:
            break
    return headlines[:max_headlines], promos[:max_promos]


# ─── Prompt Architect: DNA × Seed → Master Prompt ────────────────────────────

def _call_architect_api(system_prompt: str, user_prompt: str) -> str:
    """Text API call for the Prompt Architect — creative temperature."""
    _set_fal_key()
    result = fal_client.subscribe(
        "openrouter/router/enterprise",
        arguments={
            "system_prompt": system_prompt,
            "prompt": user_prompt,
            "model": "anthropic/claude-sonnet-5",
            "enable_web_search": False,
            "temperature": 0.65,
        },
    )
    return result["output"]


def build_master_prompt(workspace, seed: dict, aspect_ratio: str = "1:1", use_fingerprint: bool = True) -> str:
    """Synthesise brand DNA + creative seed into a production-ready master prompt.

    Args:
        workspace: Workspace instance
        seed: dict with keys: theme, concept, visual_direction, extra_notes
        aspect_ratio: e.g. "9:16", "1:1", "4:5"

    Returns:
        The master prompt string (plain text, ready for Flux).
    Raises:
        RuntimeError on API failure.
    """
    from .prompts import PROMPT_ARCHITECT_SYSTEM_PROMPT, PROMPT_ARCHITECT_USER_TEMPLATE
    from apps.creatives.services import _get_workspace_cta_pool, _pick_cta

    # Load brand DNA (only when fingerprint is enabled for this request)
    from .models import BrandFingerprint
    fp = BrandFingerprint.objects.filter(workspace=workspace).first() if use_fingerprint else None
    if fp and fp.visual_dna:
        vdna = fp.visual_dna
        neg  = fp.negative_patterns or {}
        bp   = fp.brand_profile or {}
        art_style    = vdna.get('recurring_art_style', 'digital illustration')
        color_names  = ', '.join(
            c.get('name', '') for c in vdna.get('dominant_color_tendencies', [])[:6] if c.get('name')
        ) or 'vibrant mixed palette'
        style_tags   = ', '.join(vdna.get('style_tags_ranked', [])[:5]) or 'iGaming, vibrant, high-energy'
        brand_tone   = ', '.join(bp.get('brand_tone_keywords', [])[:4]) or 'energetic, bold, playful'
        avoid_summary = neg.get('summary_negative_dna', 'none noted')
    else:
        art_style    = '3D-rendered digital illustration'
        color_names  = 'deep navy, gold, vibrant colors'
        style_tags   = 'iGaming, vibrant, high-energy'
        brand_tone   = 'energetic, bold, playful'
        avoid_summary = 'none noted'

    # CTA from corpus
    from apps.creatives.services import _get_workspace_cta_pool, _pick_cta
    cta_text = _pick_cta(_get_workspace_cta_pool(workspace))

    # Headline + promo text examples from corpus
    corpus_headlines, corpus_promos = _get_corpus_text_examples(workspace)
    headline_examples_text = '\n'.join(f'  • {h}' for h in corpus_headlines) if corpus_headlines else '  (none available — invent one in brand style)'
    promo_examples_text    = '\n'.join(f'  • {p}' for p in corpus_promos)    if corpus_promos    else '  (none available)'

    # Disclaimer from workspace default
    default_d = workspace.disclaimers.filter(is_default=True).first()
    disclaimer_text = (
        default_d.text if default_d
        else '18+. No Purchase Necessary. Void Where Prohibited. Terms and Conditions Apply.'
    )

    # Format hint
    format_map = {
        '9:16': '9:16 vertical (Story / Reel cover)',
        '4:5':  '4:5 portrait (Feed portrait)',
        '1:1':  '1:1 square (Feed square)',
        '16:9': '16:9 landscape (Banner)',
    }
    aspect_label = format_map.get(aspect_ratio, aspect_ratio)

    user_prompt = PROMPT_ARCHITECT_USER_TEMPLATE.format(
        art_style            = art_style,
        color_names          = color_names,
        style_tags           = style_tags,
        brand_tone           = brand_tone,
        avoid_summary        = avoid_summary,
        theme                = seed.get('theme', ''),
        concept              = seed.get('concept', ''),
        visual_direction     = seed.get('visual_direction', ''),
        extra_notes          = seed.get('extra_notes', '') or seed.get('extra_prompt', ''),
        aspect_ratio         = aspect_label,
        cta_text             = cta_text,
        headline_examples    = headline_examples_text,
        promo_examples       = promo_examples_text,
        disclaimer_text      = disclaimer_text,
    )

    raw = _call_architect_api(PROMPT_ARCHITECT_SYSTEM_PROMPT, user_prompt)
    # Strip any accidental markdown fences or leading/trailing whitespace
    master = raw.strip().strip('`').strip()
    if not master:
        raise RuntimeError("Prompt Architect returned empty output")
    logger.info("prompt_architect.done workspace_id=%s len=%d", workspace.id, len(master))
    return master
