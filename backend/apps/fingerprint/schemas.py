"""
Pydantic schemas for fingerprint agent outputs.
Used for validation after JSON parsing from fal.ai OpenRouter responses.
"""
from pydantic import BaseModel
from typing import Literal, Optional


# ─── Agent 1: Visual Analysis ─────────────────────────────────────────────────

class ColorEntry(BaseModel):
    hex: str
    name: str
    role: str


class SubjectInfo(BaseModel):
    main_subject: str
    secondary_elements: list[str]


class CompositionInfo(BaseModel):
    layout: str
    framing: str
    focal_point: str
    visual_hierarchy: str


class ColorProfile(BaseModel):
    dominant_colors: list[ColorEntry]
    contrast: str
    mood: str


class TypographyInImage(BaseModel):
    headline_text: Optional[str] = None
    body_text: Optional[str] = None
    font_style_description: str
    text_placement: str


class BrandingElements(BaseModel):
    logo_visible: bool
    logo_description: Optional[str] = None
    cta_visible: bool
    cta_text: Optional[str] = None
    cta_style: Optional[str] = None
    promo_badge: Optional[str] = None


class ImageAnalysisOutput(BaseModel):
    art_style: str
    subject: SubjectInfo
    composition: CompositionInfo
    color_profile: ColorProfile
    lighting: str
    background: str
    typography_in_image: TypographyInImage
    branding_elements: BrandingElements
    style_tags: list[str]
    recreate_prompt: str


# ─── Agent 2: Brand Kit Analysis ──────────────────────────────────────────────

class ColorPaletteEntry(BaseModel):
    hex: str
    name: str


class LogoInfo(BaseModel):
    visual_description: str
    color_role: str


class ColorPaletteInfo(BaseModel):
    primary: list[ColorPaletteEntry]
    secondary: list[ColorPaletteEntry]
    usage_notes: str


class TypographyInfo(BaseModel):
    primary_font_style: str
    usage_notes: str


class CtaStyleInfo(BaseModel):
    tone: str
    common_phrasing_pattern: str
    visual_style: str


class PromoStyleInfo(BaseModel):
    tone: str
    common_themes: list[str]
    sample_summary: str


class BrandProfileOutput(BaseModel):
    logo: LogoInfo
    color_palette: ColorPaletteInfo
    typography: TypographyInfo
    cta_style: CtaStyleInfo
    promo_style: PromoStyleInfo
    brand_tone_keywords: list[str]


# ─── Synthesis / Agent 4 shared ───────────────────────────────────────────────

class VisualDna(BaseModel):
    recurring_art_style: str
    recurring_composition_patterns: str
    dominant_color_tendencies: list[ColorPaletteEntry]
    recurring_lighting_mood: str
    recurring_background_style: str
    typography_tendencies: str
    style_tags_ranked: list[str]
    summary_style_dna: str


class NegativePatterns(BaseModel):
    recurring_avoid_elements: list[str]
    avoid_style_tags: list[str]
    summary_negative_dna: str


ConfidenceLevel = Literal["low", "medium", "high"]


class SynthesisOutput(BaseModel):
    visual_dna: VisualDna
    negative_patterns: NegativePatterns
    confidence: ConfidenceLevel
    based_on_image_count: int


class MergeOutput(BaseModel):
    visual_dna: VisualDna
    negative_patterns: NegativePatterns
    confidence: ConfidenceLevel
    changelog: str
    drift_flag: bool


# ─── Agent 3: Prompt Generation ───────────────────────────────────────────────

class PromptGenerationOutput(BaseModel):
    prompt: str
    negative_prompt: str
    notes: str


# ─── Campaign Intelligence: Agent 1 (Market Analyst) ─────────────────────────

class RegionalInsights(BaseModel):
    region                 : str
    market_maturity        : str
    dominant_platforms     : list[str]
    regulatory_constraints : list[str]
    cultural_creative_notes: str


class AudienceInsights(BaseModel):
    audience_profile   : str
    primary_motivations: list[str]
    creative_triggers  : list[str]
    creative_turn_offs : list[str]
    preferred_formats  : list[str]


class TrendingCreativeDirection(BaseModel):
    name              : str
    description       : str
    why_effective     : str
    visual_language   : str
    example_references: list[str]


class MarketInsightOutput(BaseModel):
    research_date                : str
    sector_context               : str
    regional_insights            : RegionalInsights
    audience_insights            : AudienceInsights
    trending_creative_directions : list[TrendingCreativeDirection]
    declining_patterns           : list[str]
    underexplored_territory      : str
    recommended_formats          : list[str]
    key_message_angles           : list[str]


# ─── Campaign Intelligence: Agent 2 (Creative Director) ──────────────────────

class CreativeBriefItem(BaseModel):
    id               : str
    type             : str
    title            : str
    concept          : str
    hero_element     : str
    color_direction  : str
    composition_style: str
    cta_approach     : str
    trend_hook       : str
    brand_fit        : str
    audience_fit     : str
    extra_prompt     : str
    confidence       : str
    risk_note        : str


class CreativeBriefOutput(BaseModel):
    director_note: str
    briefs       : list[CreativeBriefItem]
