"""
Reading competitors' ads with AI, and turning one into an idea for our brand.

analyze_ad() looks at an image ad once and records what it does — the hook,
the offer, the format — and how it is designed: how dense, which type, which
effects, what background. It runs right after a sync, while Meta's media
links are fresh, so the read outlives the links. Video ads are skipped for now.

adapt_ad() takes one analysed ad and the workspace's brand and writes a seed
in the same shape as a Trend Scout idea, so Generate's existing path — seed →
Prompt Architect → generation — takes it. Two things travel with the seed:

- style_lock: the competitor's design treatment (a flat, three-element card
  stays a flat, three-element card), recoloured in our palette. Without it
  the Prompt Architect renders every idea in the brand's own art style, and a
  sparse reference comes back dense.
- headline / promo_line: on-image copy taken from our Brand Kit offers, used
  verbatim. The competitor's offer, numbers and wording never carry over;
  check_idea() enforces that in code rather than trusting the model.
"""
import logging
import re
import uuid

import requests
from django.db.models import Q
from django.utils import timezone
from pydantic import BaseModel, ValidationError

from .models import CompetitorAd

logger = logging.getLogger(__name__)

MAX_IMAGES_PER_AD = 4
# Per sync: enough for a page's whole first read, bounded so one huge page
# can't hold the browser slot's thread for an hour.
MAX_ANALYSES_PER_SYNC = 40
# Bumped when the analysis asks for something new; older reads are redone.
ANALYSIS_VERSION = 2
ADAPT_ATTEMPTS = 2


class AdOffer(BaseModel):
    type: str = ''        # e.g. deposit match, free spins, referral, cashback, none
    text: str = ''        # verbatim, as the ad shows it


class AdVisual(BaseModel):
    composition: str = ''
    subjects: str = ''
    colors: list[str] = []
    text_overlay: str = ''
    style: str = ''


class AdDesign(BaseModel):
    density: str = ''         # minimal | moderate | busy
    element_count: int = 0    # distinct visual elements, text blocks included
    typography: str = ''
    effects: str = ''         # e.g. "none — flat fills", "3D bevel, glow, particles"
    background: str = ''
    recipe: str = ''          # one-sentence rendering recipe, colours left out


class AdAnalysis(BaseModel):
    format: str           # short label: offer card, gameplay screenshot, streamer moment, testimonial…
    hook: str             # what stops the scroll, as a mechanism — not the offer's words
    angle: str            # the kind of promise, not its numbers
    offer: AdOffer = AdOffer()
    emotion: str = ''
    audience: str = ''
    visual: AdVisual = AdVisual()
    design: AdDesign = AdDesign()
    why_it_works: str = ''
    tags: list[str] = []


class AdaptedIdea(BaseModel):
    theme: str
    concept: str
    visual_direction: str
    extra_prompt: str
    style_lock: str
    headline: str = ''
    promo_line: str = ''
    insight: str


ANALYSIS_SYSTEM_PROMPT = """You are a performance creative strategist who studies competitors' paid social ads (Meta: Facebook and Instagram).

You will see the image(s) of ONE ad and its copy. Describe what the ad does and how it is designed, so another brand can learn from the mechanics without copying the content. Be concrete about what is visible; do not guess.

Keep the competitor's specific offer out of every field except "offer" and "visual.text_overlay": no amounts, percentages, prices, coin counts or offer wording anywhere else. Describe mechanics instead — "an oversized number fills the frame", not "a giant 100%".

Return ONLY a JSON object with exactly these keys:
{
  "format": "a short label for the creative format, e.g. offer card, gameplay screenshot, streamer moment, testimonial, before/after, meme, product shot",
  "hook": "what stops the scroll, as a mechanism, in one sentence",
  "angle": "the kind of promise it makes (e.g. low-risk bonus, social proof, instant win), in one sentence, no numbers",
  "offer": {"type": "deposit match | free spins | referral | cashback | free entry | none | other", "text": "the offer exactly as the ad states it, or empty"},
  "emotion": "the main emotion it plays on",
  "audience": "who it seems aimed at",
  "visual": {
    "composition": "layout and focal point",
    "subjects": "who or what is shown",
    "colors": ["3-5 dominant colors"],
    "text_overlay": "the words on the image, verbatim",
    "style": "photo, UI screenshot, 3D render, flat graphic, illustration, UGC, etc."
  },
  "design": {
    "density": "minimal | moderate | busy",
    "element_count": 0,
    "typography": "typeface character, weight, case and how many styles are used",
    "effects": "every effect used (3D, bevel, glow, gradient, texture, particles, shadows) — or 'none — flat fills'",
    "background": "what is behind the content (solid color, gradient, photo, scene)",
    "recipe": "one sentence another designer could follow to reproduce this treatment, leaving the colors out"
  },
  "why_it_works": "1-2 sentences on why this is likely effective, as mechanics, no numbers",
  "tags": ["3-6 short lowercase tags"]
}"""

ANALYSIS_USER_PROMPT = """Advertiser: {page_name}
Has been running for: {days} days{rank}
Headline: {title}
Primary text: {body}
Call to action: {cta}

Analyse this ad."""

ADAPT_SYSTEM_PROMPT = """You are a senior creative director. You are given one competitor ad that is working in the market, and the profile of OUR brand. Write ONE static image ad idea for our brand that borrows what makes the competitor ad work — its hook mechanics, layout and design restraint — and fills it with OUR offer, OUR palette and OUR brand.

Design — keep the competitor's treatment:
- Match its density, element count, typography character, effects and background type. If it is a flat, minimal card with three elements, ours is a flat, minimal card with about three elements: do not add glow, sparkles, particles, bokeh, lens flare, ornate frames, bevels, mascots or extra badges it does not have.
- Recolour it in our palette. Our brand's art style applies only where the competitor's treatment leaves room for it.
- "style_lock" is that treatment as one rendering instruction for an image model, written in our colours — e.g. "Flat graphic design, solid deep-purple background, one heavy condensed sans-serif in gold, one emerald accent shape, no 3D, no gradients, no glow, no texture".

Copy — ours, never theirs:
- "headline" and "promo_line" are the only words on the image besides the button and the legal line. Take them from OUR BRAND OFFERS, verbatim or trimmed — never reworded, never invented. An offer written "A | B" may be split: A as the headline, B as the promo line.
- If OUR BRAND OFFERS is empty, leave both empty.
- Never reuse the competitor's offer, amounts, percentages, wording, name, logo or people — not in the copy, and not in any other field.

Return ONLY a JSON object with exactly these keys:
{
  "theme": "a 2-5 word title for the idea",
  "concept": "the idea in 1-2 sentences",
  "visual_direction": "what the image shows and how it is laid out, element by element",
  "extra_prompt": "a ready-to-use prompt addition for an image model (2-4 sentences)",
  "style_lock": "the rendering instruction described above",
  "headline": "from OUR BRAND OFFERS, or empty",
  "promo_line": "from OUR BRAND OFFERS, or empty",
  "insight": "one sentence: what we took from the competitor ad and why"
}"""

ADAPT_USER_PROMPT = """COMPETITOR AD ({page_name}, running {days} days{rank}):
Format: {format}
Hook: {hook}
Angle: {angle}
Emotion: {emotion}
Audience: {audience}
Composition: {composition}
Design density: {density} ({element_count} elements)
Typography: {typography}
Effects: {effects}
Background: {background}
Design recipe: {recipe}
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

RETRY_NOTE = """

Your previous answer broke the copy rules: {problems}
Write it again, using only OUR BRAND OFFERS for any offer or number."""

# Offer vocabulary that must not appear in an idea unless our own offers use it.
# Kept to phrases: a bare "match" or "refer" turns up in ordinary design
# language ("match the palette", "reference").
OFFER_WORDS = ('deposit', 'bonus', 'cashback', 'cash back', 'free spins', 'refer a friend',
               'double your', 'first purchase')
# Money, percentages, and numbers of two digits or more — single digits are
# too common in layout talk ("3 elements") to say anything about an offer.
_FIGURE = re.compile(r'[$€£]\s?\d[\d,.]*|\d[\d,.]*\s?%|\d{2,}[\d,.]*')


def ad_image_urls(ad):
    return [m['url'] for m in (ad.media or []) if m.get('type') == 'image' and m.get('url')][:MAX_IMAGES_PER_AD]


def needs_analysis(ad):
    return ad.analysis_status in ('', 'failed') or (
        ad.analysis_status == 'done' and (ad.analysis or {}).get('version', 1) < ANALYSIS_VERSION)


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
        logger.warning('competitors.analysis_failed ad=%s error=%s', ad.pk, exc)
        CompetitorAd.objects.filter(pk=ad.pk).update(analysis_status='failed', analysis_error=str(exc)[:1000])
        return False
    CompetitorAd.objects.filter(pk=ad.pk).update(
        analysis={**result.model_dump(), 'version': ANALYSIS_VERSION},
        analysis_status='done', analysis_error='', analyzed_at=timezone.now())
    return True


def analyze_new_ads(competitor):
    """
    Analyse this competitor's running ads that haven't been read yet, whose
    last read failed, or whose read predates the current analysis. Called
    straight after a sync, while the links are fresh.
    """
    stale = Q(analysis_status='done') & (Q(analysis__version__lt=ANALYSIS_VERSION)
                                         | Q(analysis__version__isnull=True))
    pending = (CompetitorAd.objects
               .filter(competitor=competitor, is_active=True)
               .filter(Q(analysis_status__in=('', 'failed')) | stale)
               .select_related('competitor')
               .order_by('position')[:MAX_ANALYSES_PER_SYNC])
    done = 0
    for ad in pending:
        done += analyze_ad(ad)
    return done


def _norm(text):
    return re.sub(r'\s+', ' ', (text or '').lower()).strip()


def _figures(text):
    """Amounts, percentages and other numbers in a piece of text, normalised."""
    return {re.sub(r'[\s,]', '', f) for f in _FIGURE.findall(text or '')}


def check_idea(idea, ad, offers):
    """
    What in this idea comes from the competitor rather than from us. Returns a
    list of problems; empty means it is clean.
    """
    ours = _norm(' | '.join(offers))
    a = ad.analysis or {}
    theirs = ' '.join([
        (a.get('offer') or {}).get('text', ''), (a.get('visual') or {}).get('text_overlay', ''),
        ad.title or '', ad.body or '',
    ])
    text = ' '.join([idea.theme, idea.concept, idea.visual_direction, idea.extra_prompt,
                     idea.style_lock, idea.headline, idea.promo_line])
    problems = []

    borrowed = sorted(_figures(text) & (_figures(theirs) - _figures(ours)))
    if borrowed:
        problems.append(f'it uses the competitor\'s figures {", ".join(borrowed)}')
    words = [w for w in OFFER_WORDS if w in _norm(text) and w not in ours]
    if words:
        problems.append(f'it mentions offers we do not run ({", ".join(words)})')
    for field in ('headline', 'promo_line'):
        value = _norm(getattr(idea, field))
        if value and value not in ours:
            problems.append(f'the {field} "{getattr(idea, field)}" is not one of our offers')
    if not offers and (idea.headline or idea.promo_line):
        problems.append('it adds copy although we listed no offers')
    return problems


def adapt_ad(ad, workspace):
    """
    One idea for our brand from one analysed competitor ad, shaped like a
    Trend Scout idea. Raises RuntimeError when no clean idea comes back.
    """
    from apps.creatives.services import _load_promo_texts
    from apps.fingerprint.models import BrandFingerprint
    from apps.fingerprint.services import _call_text_api, _parse_json_output

    a = ad.analysis or {}
    d = a.get('design') or {}
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
        density=d.get('density') or 'unknown', element_count=d.get('element_count') or '?',
        typography=d.get('typography', ''), effects=d.get('effects', ''),
        background=d.get('background', ''), recipe=d.get('recipe', ''),
        why=a.get('why_it_works', ''),
        brand_name=workspace.name,
        art_style=dna.get('recurring_art_style') or 'not yet profiled',
        colors=', '.join(c.get('name', '') for c in dna.get('dominant_color_tendencies', [])[:6]
                         if isinstance(c, dict) and c.get('name')) or 'not yet profiled',
        style_tags=', '.join(dna.get('style_tags_ranked', [])[:6]) or 'not yet profiled',
        tone=', '.join(profile.get('brand_tone_keywords', [])[:5]) or 'not yet profiled',
        avoid=neg.get('summary_negative_dna') or 'nothing noted',
        offers='\n'.join(f'  - {o}' for o in offers) if offers else '  (none — leave headline and promo_line empty)',
    )

    note, idea, problems = '', None, []
    for _ in range(ADAPT_ATTEMPTS):
        try:
            idea = AdaptedIdea.model_validate(
                _parse_json_output(_call_text_api(ADAPT_SYSTEM_PROMPT, prompt + note)))
        except (ValueError, ValidationError) as exc:
            raise RuntimeError(f'The idea came back malformed: {exc}') from exc
        problems = check_idea(idea, ad, offers)
        if not problems:
            break
        logger.info('competitors.adapt_retry ad=%s problems=%s', ad.pk, problems)
        note = RETRY_NOTE.format(problems='; '.join(problems))
    if problems:
        raise RuntimeError(f'The idea kept borrowing the competitor\'s copy: {"; ".join(problems)}')

    return {
        **idea.model_dump(),
        'id': f'competitor-{ad.pk}-{uuid.uuid4().hex[:6]}',
        'source': {
            'competitor_ad_id': ad.pk,
            'competitor_name': ad.competitor.page_name,
            'image': next(iter(ad_image_urls(ad)), None),
        },
    }
