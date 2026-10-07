"""
Reading competitors' ads with AI, and turning one into an idea for our brand.

analyze_ad() looks at an image ad once and records what it does — the hook,
the offer, the format, the look. It runs right after a sync, while Meta's
media links are fresh, so the read outlives the links. Video ads are skipped
for now.

adapt_ad() takes one analysed ad and the workspace's brand (fingerprint,
Brand Kit offers) and writes a seed in the same shape as a Trend Scout idea,
so Generate's existing path — seed → Prompt Architect → generation — takes it
unchanged.
"""
import logging
import uuid

import requests
from django.utils import timezone
from pydantic import BaseModel, ValidationError

from .models import CompetitorAd

logger = logging.getLogger(__name__)

MAX_IMAGES_PER_AD = 4
# Per sync: enough for a page's whole first read, bounded so one huge page
# can't hold the browser slot's thread for an hour.
MAX_ANALYSES_PER_SYNC = 40


class AdOffer(BaseModel):
    type: str = ''        # e.g. deposit match, free spins, referral, cashback, none
    text: str = ''        # verbatim, as the ad shows it


class AdVisual(BaseModel):
    composition: str = ''
    subjects: str = ''
    colors: list[str] = []
    text_overlay: str = ''
    style: str = ''


class AdAnalysis(BaseModel):
    format: str           # short label: offer card, gameplay screenshot, streamer moment, testimonial…
    hook: str             # what stops the scroll, one sentence
    angle: str            # the core promise or reason to act
    offer: AdOffer = AdOffer()
    emotion: str = ''
    audience: str = ''
    visual: AdVisual = AdVisual()
    why_it_works: str = ''
    tags: list[str] = []


class AdaptedIdea(BaseModel):
    theme: str
    concept: str
    visual_direction: str
    extra_prompt: str
    insight: str


ANALYSIS_SYSTEM_PROMPT = """You are a performance creative strategist who studies competitors' paid social ads (Meta: Facebook and Instagram).

You will see the image(s) of ONE ad and its copy. Describe what the ad does so another team can learn from it. Be concrete and specific to what is visible; do not guess at things you cannot see.

Return ONLY a JSON object with exactly these keys:
{
  "format": "a short label for the creative format, e.g. offer card, gameplay screenshot, streamer moment, testimonial, before/after, meme, product shot",
  "hook": "what stops the scroll, in one sentence",
  "angle": "the core promise or reason to act, in one sentence",
  "offer": {"type": "deposit match | free spins | referral | cashback | free entry | none | other", "text": "the offer exactly as the ad states it, or empty"},
  "emotion": "the main emotion it plays on",
  "audience": "who it seems aimed at",
  "visual": {
    "composition": "layout and focal point",
    "subjects": "who or what is shown",
    "colors": ["3-5 dominant colors"],
    "text_overlay": "the words on the image, verbatim",
    "style": "photo, UI screenshot, 3D render, illustration, UGC, etc."
  },
  "why_it_works": "1-2 sentences on why this is likely effective",
  "tags": ["3-6 short lowercase tags"]
}"""

ANALYSIS_USER_PROMPT = """Advertiser: {page_name}
Has been running for: {days} days{rank}
Headline: {title}
Primary text: {body}
Call to action: {cta}

Analyse this ad."""

ADAPT_SYSTEM_PROMPT = """You are a senior creative director. You are given one competitor ad that is working in the market, and the profile of OUR brand. Write ONE creative idea for our brand that borrows what makes the competitor ad work — its hook mechanics, format, angle and composition logic — and expresses it entirely in our brand's own visual identity.

Hard rules:
- Never use the competitor's name, logo, characters, people, product UI or slogans. The idea must be unmistakably ours.
- OFFERS: use only an offer from OUR BRAND OFFERS, worded as given. If none fits, or none are listed, make no specific offer (no amounts, no bonuses). Never carry over the competitor's offer.
- Static image only.
- Keep the visual direction concrete enough for an image model: subjects, composition, colors from our palette, the text that appears on the image.

Return ONLY a JSON object with exactly these keys:
{
  "theme": "a 2-5 word title for the idea",
  "concept": "the idea in 1-2 sentences",
  "visual_direction": "what the image shows and how it is laid out",
  "extra_prompt": "a ready-to-use prompt addition for an image model (2-4 sentences)",
  "insight": "one sentence: what we took from the competitor ad and why"
}"""

ADAPT_USER_PROMPT = """COMPETITOR AD ({page_name}, running {days} days{rank}):
Format: {format}
Hook: {hook}
Angle: {angle}
Emotion: {emotion}
Audience: {audience}
Composition: {composition}
Style: {style}
Why it works: {why}

OUR BRAND: {brand_name}
Visual style: {art_style}
Palette: {colors}
Style tags: {style_tags}
Tone: {tone}
Avoid: {avoid}

OUR BRAND OFFERS:
{offers}

Write the idea."""


def ad_image_urls(ad):
    return [m['url'] for m in (ad.media or []) if m.get('type') == 'image' and m.get('url')][:MAX_IMAGES_PER_AD]


def _rehost(url):
    """
    Copy one of Meta's images to fal's CDN. The model provider fetches image
    URLs itself, and Meta's CDN is not dependable for fetches that aren't a
    browser — we can read it, so we pass it on.
    """
    from apps.fingerprint.services import _set_fal_key
    import fal_client
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    _set_fal_key()
    return fal_client.upload(resp.content, resp.headers.get('Content-Type') or 'image/jpeg')


def _rank(ad):
    return f', #{ad.position} by reach' if ad.is_active and ad.position else ''


def analyze_ad(ad):
    """Analyse one ad's images and store the result on it. Returns True if it now has an analysis."""
    from apps.fingerprint.services import _call_vision_api, _parse_json_output

    urls = ad_image_urls(ad)
    if not urls:
        CompetitorAd.objects.filter(pk=ad.pk).update(analysis_status='skipped', analysis_error='')
        return False
    try:
        hosted = [_rehost(u) for u in urls]
        raw = _call_vision_api(hosted, ANALYSIS_SYSTEM_PROMPT, ANALYSIS_USER_PROMPT.format(
            page_name=ad.competitor.page_name or 'unknown',
            days=ad.days_running if ad.days_running is not None else '?',
            rank=_rank(ad),
            title=ad.title or '(none)', body=ad.body or '(none)', cta=ad.cta_text or '(none)',
        ))
        result = AdAnalysis.model_validate(_parse_json_output(raw))
    except Exception as exc:   # download, model provider, or an unusable answer
        return _failed(ad, exc)
    CompetitorAd.objects.filter(pk=ad.pk).update(
        analysis=result.model_dump(), analysis_status='done', analysis_error='', analyzed_at=timezone.now())
    return True


def _failed(ad, exc):
    logger.warning('competitors.analysis_failed ad=%s error=%s', ad.pk, exc)
    CompetitorAd.objects.filter(pk=ad.pk).update(analysis_status='failed', analysis_error=str(exc)[:1000])
    return False


def analyze_new_ads(competitor):
    """
    Analyse this competitor's running ads that haven't been read yet (or whose
    last read failed). Called straight after a sync, while the links are fresh.
    """
    pending = (CompetitorAd.objects
               .filter(competitor=competitor, is_active=True, analysis_status__in=('', 'failed'))
               .select_related('competitor')
               .order_by('position')[:MAX_ANALYSES_PER_SYNC])
    done = 0
    for ad in pending:
        done += analyze_ad(ad)
    return done


def adapt_ad(ad, workspace):
    """
    One idea for our brand from one analysed competitor ad, shaped like a
    Trend Scout idea. Raises RuntimeError when the model's answer is unusable.
    """
    from apps.creatives.services import _load_promo_texts
    from apps.fingerprint.models import BrandFingerprint
    from apps.fingerprint.services import _call_text_api, _parse_json_output

    a = ad.analysis or {}
    fp = BrandFingerprint.objects.filter(workspace=workspace).first()
    dna = (fp.visual_dna if fp else None) or {}
    profile = (fp.brand_profile if fp else None) or {}
    neg = (fp.negative_patterns if fp else None) or {}
    offers = _load_promo_texts(workspace.id)

    prompt = ADAPT_USER_PROMPT.format(
        page_name=ad.competitor.page_name or 'competitor',
        days=ad.days_running if ad.days_running is not None else '?',
        rank=_rank(ad),
        format=a.get('format', ''), hook=a.get('hook', ''), angle=a.get('angle', ''),
        emotion=a.get('emotion', ''), audience=a.get('audience', ''),
        composition=(a.get('visual') or {}).get('composition', ''),
        style=(a.get('visual') or {}).get('style', ''),
        why=a.get('why_it_works', ''),
        brand_name=workspace.name,
        art_style=dna.get('recurring_art_style') or 'not yet profiled',
        colors=', '.join(c.get('name', '') for c in dna.get('dominant_color_tendencies', [])[:6]
                         if isinstance(c, dict) and c.get('name')) or 'not yet profiled',
        style_tags=', '.join(dna.get('style_tags_ranked', [])[:6]) or 'not yet profiled',
        tone=', '.join(profile.get('brand_tone_keywords', [])[:5]) or 'not yet profiled',
        avoid=neg.get('summary_negative_dna') or 'nothing noted',
        offers='\n'.join(f'  - {o}' for o in offers) if offers else '  (none — make no specific offer)',
    )
    try:
        idea = AdaptedIdea.model_validate(_parse_json_output(_call_text_api(ADAPT_SYSTEM_PROMPT, prompt)))
    except (ValueError, ValidationError) as exc:
        raise RuntimeError(f'The idea came back malformed: {exc}') from exc

    return {
        **idea.model_dump(),
        'id': f'competitor-{ad.pk}-{uuid.uuid4().hex[:6]}',
        'source': {
            'competitor_ad_id': ad.pk,
            'competitor_name': ad.competitor.page_name,
            'image': next(iter(ad_image_urls(ad)), None),
        },
    }
