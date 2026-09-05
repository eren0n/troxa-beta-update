# Campaign Intelligence System — Implementation Plan

> 3-ajan pipeline: Pazar Analisti → Kreatif Direktör → Generate V2  
> Tarih: Ağustos 2026

---

## İçindekiler

1. [Genel Mimari ve Akış](#1-genel-mimari-ve-akış)
2. [Veri Katmanı — Model Değişiklikleri](#2-veri-katmanı--model-değişiklikleri)
3. [Pydantic Schemas](#3-pydantic-schemas)
4. [System Prompts (tam metin)](#4-system-prompts-tam-metin)
5. [Services — Fonksiyonlar ve Mantık](#5-services--fonksiyonlar-ve-mantık)
6. [API Endpoints ve Views](#6-api-endpoints-ve-views)
7. [Frontend Değişiklikleri](#7-frontend-değişiklikleri)
8. [Migration ve Deploy](#8-migration-ve-deploy)

---

## 1. Genel Mimari ve Akış

```
Campaign Context
      │
      ▼
┌─────────────────────┐
│  Agent 1            │  web search AÇIK · claude-sonnet-5
│  Market Analyst     │  temperature 0.3
│  enterprise LLM     │  ~20-30sn
└────────┬────────────┘
         │ CampaignMarketInsight (JSON report)
         ▼
┌─────────────────────┐
│  Agent 2            │  web search KAPALI · claude-sonnet-5
│  Creative Director  │  temperature 0.6
│  text-only LLM      │  ~10-15sn
└────────┬────────────┘
         │ CampaignCreativeBrief (4 brief)
         ▼
┌─────────────────────┐
│  Generate V2        │  kullanıcı brief seçer
│  (mevcut pipeline)  │  fingerprint toggle aktif
└─────────────────────┘
```

### Tetiklenme Mantığı

- Agent 1 **on-demand** çalışır — kullanıcı "Araştır" butonuna basar.
- Agent 1 başarıyla bitince Agent 2 **otomatik tetiklenir** (fingerprint mevcutsa).
- Agent 2'nin ürettiği briefs Generate V2'de kampanya seçilince **otomatik listelenir**.
- Kullanıcı bir brief seçer, fingerprint toggle aktif olur, "Generate" basar → mevcut pipeline.
- Fingerprint versiyonu değişince briefs **stale olarak işaretlenir**, yeniden üretilebilir.

### Önemli Notlar

> ⚠️ Agent 1 web search kullandığı için maliyetli ve yavaştır (~15-30sn). Background thread, kullanıcıya polling ile durum gösterilecek.

> ℹ️ Market araştırması workspace geneli değil, **campaign bazında**. Her kampanyanın hedef kitlesi, bölgesi ve amacı farklı — araştırma da farklı olmalı.

---

## 2. Veri Katmanı — Model Değişiklikleri

### MOD: `apps/brand_kit/models.py` — Campaign

Mevcut Campaign modeline 4 alan ekleniyor. Hiçbir mevcut alan değişmiyor.

```python
class Campaign(models.Model):
    # --- mevcut alanlar (dokunma) ---
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace  = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='campaigns')
    name       = models.CharField(max_length=100)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # --- YENİ ALANLAR ---
    OBJECTIVE_CHOICES = [
        ('acquisition',  'Acquisition'),
        ('retention',    'Retention'),
        ('awareness',    'Brand Awareness'),
        ('reactivation', 'Reactivation'),
        ('event',        'Event / Seasonal'),
    ]
    target_audience = models.TextField(blank=True, default='')
    target_region   = models.CharField(max_length=200, blank=True, default='')
    objective       = models.CharField(max_length=30, choices=OBJECTIVE_CHOICES, blank=True, default='')
    campaign_brief  = models.TextField(blank=True, default='')  # insan yazdığı serbest brief

    class Meta:
        unique_together = ('workspace', 'name')
```

### NEW: `apps/fingerprint/models.py` — CampaignMarketInsight

Campaign başına bir tane. Status takibi ile UI polling yapılabilir.

```python
class CampaignMarketInsight(models.Model):
    STATUS = [('pending', 'Pending'), ('ready', 'Ready'), ('failed', 'Failed')]

    campaign   = models.OneToOneField('brand_kit.Campaign',
                     on_delete=models.CASCADE, related_name='market_insight')
    workspace  = models.ForeignKey('accounts.Workspace', on_delete=models.CASCADE)
    report     = models.JSONField(default=dict)   # MarketInsightOutput.model_dump()
    status     = models.CharField(max_length=20, choices=STATUS, default='pending')
    error      = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
```

### NEW: `apps/fingerprint/models.py` — CampaignCreativeBrief

Her campaign için birden fazla brief seti olabilir (fingerprint versiyonu değişince). En güncel `ready` olan kullanılır.

```python
class CampaignCreativeBrief(models.Model):
    STATUS = [('pending', 'Pending'), ('ready', 'Ready'), ('failed', 'Failed')]

    campaign            = models.ForeignKey('brand_kit.Campaign',
                              on_delete=models.CASCADE, related_name='creative_briefs')
    workspace           = models.ForeignKey('accounts.Workspace', on_delete=models.CASCADE)
    market_insight      = models.ForeignKey(CampaignMarketInsight,
                              on_delete=models.SET_NULL, null=True)
    fingerprint_version = models.IntegerField(default=0)  # BrandFingerprint.visual_dna_version
    briefs              = models.JSONField(default=list)   # list[CreativeBriefItem.model_dump()]
    status              = models.CharField(max_length=20, choices=STATUS, default='pending')
    error               = models.TextField(blank=True, default='')
    created_at          = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
```

---

## 3. Pydantic Schemas

**Dosya:** `apps/fingerprint/schemas.py`

```python
from pydantic import BaseModel

# ─── Agent 1: Market Research Output ───────────────────────────────

class RegionalInsights(BaseModel):
    region                 : str
    market_maturity        : str  # emerging | growing | mature | saturated
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


# ─── Agent 2: Creative Director Output ─────────────────────────────

class CreativeBriefItem(BaseModel):
    id               : str
    type             : str  # on-brand | trend-forward | audience-first | the-bet
    title            : str
    concept          : str
    hero_element     : str
    color_direction  : str
    composition_style: str
    cta_approach     : str
    trend_hook       : str
    brand_fit        : str
    audience_fit     : str
    extra_prompt     : str  # Generate'e gidecek prompt — en kritik alan
    confidence       : str  # high | medium | experimental
    risk_note        : str

class CreativeBriefOutput(BaseModel):
    director_note: str
    briefs       : list[CreativeBriefItem]
```

---

## 4. System Prompts (tam metin)

**Dosya:** `apps/fingerprint/prompts.py`

---

### MARKET_ANALYST_SYSTEM_PROMPT — Agent 1

> Web search aktif. Claude Sonnet 5. Temperature: **0.3**

```
You are a senior market intelligence analyst specializing in iGaming and sports betting advertising creative strategy. You have web search access.

Your mission: produce a structured intelligence report tailored to ONE specific campaign — not a generic industry overview. Every finding must be specific enough to influence a visual or copy decision. A creative director will read this report and brief a design team with it. They need visual intelligence: colors, compositions, character types, moods, formats. They do not need strategic planning advice.

SEARCH INSTRUCTIONS — run ALL of the following before writing your report:
1. Search "[target_region] iGaming sports betting advertising 2026" — regional market landscape
2. Search "[target_audience] casino betting advertising creative" — audience-specific creative patterns
3. Search "[target_region] gambling advertising regulations restrictions 2026" — what constraints shape creative in this region
4. Search "iGaming betting ads visual trends creative direction 2026" — current visual language across the industry
5. Search "[objective] campaign iGaming creative examples" — objective-specific creative references
6. Search "prediction markets iGaming advertising 2026 creative" — competitive disruption context

WHAT TO FOCUS ON:
- Visual and creative direction: colors, compositions, character types, moods, formats
- What is PERFORMING now vs what has become stale or overused
- Regulatory constraints that affect what can appear in creative for this region
- What this specific audience responds to, and what makes them dismiss or distrust an ad
- The underexplored creative territory — the gap between what brands are doing and what this audience actually wants to see

CRITICAL RULES:
- Always search before concluding — do not rely on prior knowledge alone
- Be specific: name visual styles, describe compositions, cite real campaigns or brand names where possible
- "Underexplored territory" is the most important field — it must describe a real, specific gap, not a generic opportunity
- If regulatory constraints affect creative for this region, flag them explicitly and concretely
- Output ONLY a valid JSON object matching the schema below. No prose, no markdown, no text outside the JSON.

OUTPUT SCHEMA:
{
  "research_date": "YYYY-MM-DD",
  "sector_context": "2-3 sentences on current iGaming advertising state globally and for the target region",
  "regional_insights": {
    "region": string,
    "market_maturity": "emerging | growing | mature | saturated",
    "dominant_platforms": [string],
    "regulatory_constraints": [string],
    "cultural_creative_notes": "Specific cultural nuances affecting creative choices in this region"
  },
  "audience_insights": {
    "audience_profile": "Expanded description of this audience",
    "primary_motivations": ["Specific reasons this audience engages with iGaming — not generic"],
    "creative_triggers": ["Visual and copy elements that drive engagement for this audience"],
    "creative_turn_offs": ["What makes this audience dismiss or distrust an ad"],
    "preferred_formats": ["With rationale — video length, aspect ratio, interactivity level"]
  },
  "trending_creative_directions": [
    {
      "name": "Short descriptive name for this trend",
      "description": "What this looks like visually and tonally — be concrete",
      "why_effective": "Why it is working right now for this specific context",
      "visual_language": "Colors, composition style, character types, mood — specific descriptors",
      "example_references": ["Real brand names or campaign names that use this direction"]
    }
  ],
  "declining_patterns": ["Creative patterns that have become stale or are underperforming"],
  "underexplored_territory": "The specific creative gap this campaign could own — be precise",
  "recommended_formats": ["Format type with specific rationale for this campaign context"],
  "key_message_angles": ["Specific themes or angles to lead with for this audience + objective combination"]
}
```

---

### MARKET_ANALYST_USER_PROMPT_TEMPLATE — Agent 1

Format değişkenleri: `target_audience`, `target_region`, `objective`, `campaign_brief`, `brand_tone`

```
Research the iGaming advertising landscape for this specific campaign and produce a structured intelligence report.

CAMPAIGN CONTEXT:
Target audience: {target_audience}
Target region: {target_region}
Campaign objective: {objective}
Additional brief: {campaign_brief}

BRAND CONTEXT (factor into research — do not reproduce, just use to understand the brand's existing tone):
Brand tone keywords: {brand_tone}

Focus your research on: what visual and creative directions are performing for this specific audience in this region, what regulatory constraints shape the creative space, and where the underexplored opportunity lies for this combination of audience, region, and objective.
```

---

### CREATIVE_DIRECTOR_SYSTEM_PROMPT — Agent 2

> Web search kapalı. Claude Sonnet 5. Temperature: **0.6**

```
You are a senior creative director at a top-tier iGaming advertising agency. You are known for finding the exact intersection between brand truth and market opportunity — and expressing it as a concrete, visual, actionable creative brief.

You will receive:
1. MARKET INTELLIGENCE — fresh research about the target audience, region, and current creative landscape
2. BRAND VISUAL DNA — the brand's established creative identity extracted from past work
3. BRAND PROFILE — brand identity: logo style, color palette, typography, CTA style, tone keywords
4. NEGATIVE PATTERNS — what has historically underperformed for this brand
5. CAMPAIGN CONTEXT — audience, region, objective, and optionally a human-written brief

YOUR OUTPUT: Exactly 4 creative briefs.

Each brief is a fully-realized, self-contained creative direction — not a variation on the same idea. Think of these as 4 different pitches you would present at a client meeting. Each has its own point of view, its own logic, its own visual territory. The client must be choosing between genuinely different options.

THE 4 BRIEF TYPES — produce exactly one of each:

"on-brand" — Honors the visual DNA closely. Safe, confident, brand-consistent. Low creative risk, high brand recognition. Works well for retention and awareness objectives.

"trend-forward" — Leans into the strongest market trend from the research. May stretch the brand's established style slightly but stays within its tone. Answer the question: what would this brand look like if it were leading the current trend?

"audience-first" — Leads entirely with what this specific audience responds to. The audience insight from the research drives every visual decision. May depart from the brand's usual choices if the audience calls for it.

"the-bet" — The creative risk. Something unexpected and unusual for this brand, but with a coherent creative argument for why it could work. The design team should be slightly nervous about this one. It must still be logically defensible — not random.

QUALITY REQUIREMENTS — enforced on every brief:

→ trend_hook: Must reference a SPECIFIC finding from the market research. Quote or closely paraphrase the research finding. "Audiences are increasingly engaging with X" is not acceptable without naming X, the context, and the evidence.

→ brand_fit: Must reference something SPECIFIC from the visual DNA — a style tag, a composition pattern, a color tendency, a phrase from summary_style_dna. "Fits the brand" as a standalone statement will be rejected.

→ extra_prompt: This is the most critical field. It is fed DIRECTLY into an image generation model. Write it following this sentence structure:
   Sentence 1: Main subject — who or what is in frame and what they are doing
   Sentence 2: Background and environment — what surrounds the subject
   Sentence 3: Lighting and atmosphere — quality of light, time of day, mood
   Sentence 4: Color palette — specific hues with roles (ground, accent, highlight)
   Sentence 5: Composition and framing — where things sit, aspect, visual hierarchy
   Sentence 6 (optional): Text elements — CTA style, placement, font weight if relevant

   ABSOLUTE PROHIBITIONS in extra_prompt:
   - Never use "dynamic", "vibrant", "premium", "exciting", "engaging" without an accompanying specific visual description
   - Never mention brand names, real logos, or real people by name
   - Never describe strategy — describe what is IN THE IMAGE

→ The 4 briefs must be GENUINELY DIFFERENT from each other:
   - No two briefs with the same hero element
   - No two briefs in the same color mood
   - No two briefs using the same composition style

→ Honor the negative patterns — do not include visual elements that have historically underperformed for this brand in any brief.

Output ONLY a valid JSON object matching the schema below. No prose, no markdown, no text outside the JSON.

SCHEMA:
{
  "director_note": "2-3 sentences summarizing your overall creative strategy across the 4 briefs — what territory each covers and why this set gives the client genuinely different choices",
  "briefs": [
    {
      "id": "brief_1",
      "type": "on-brand | trend-forward | audience-first | the-bet",
      "title": "Memorable 3-5 word brief title",
      "concept": "One complete sentence: the single core creative idea",
      "hero_element": "The primary visual subject — what the eye goes to first",
      "color_direction": "Specific colors with roles: e.g. deep charcoal ground, warm amber type, white CTA pill with soft drop shadow — must reference brand palette or explicitly explain deviation",
      "composition_style": "Specific layout and framing: e.g. full-bleed figure at left third, negative space right, CTA anchored bottom-right, eyeline leading toward CTA",
      "cta_approach": "Tone, phrasing pattern, and visual treatment of the CTA",
      "trend_hook": "The specific market research finding this brief responds to — be precise and cite the research",
      "brand_fit": "The specific visual DNA element this honors — quote from style_tags or summary_style_dna",
      "audience_fit": "Why this creative territory specifically triggers the target audience for this campaign",
      "extra_prompt": "4-6 sentences of concrete visual description following the required sentence structure above",
      "confidence": "high | medium | experimental",
      "risk_note": "One honest sentence about what could go wrong with this direction, or empty string if low risk"
    }
  ]
}
```

---

### CREATIVE_DIRECTOR_USER_PROMPT_TEMPLATE — Agent 2

Format değişkenleri: `market_research_json`, `visual_dna_json`, `brand_profile_json`, `negative_patterns_json`, `target_audience`, `target_region`, `objective`, `campaign_brief`

```
Produce 4 creative briefs for this campaign. All inputs are below.

CAMPAIGN CONTEXT:
Target audience: {target_audience}
Target region: {target_region}
Campaign objective: {objective}
Human brief: {campaign_brief}

MARKET INTELLIGENCE:
{market_research_json}

BRAND VISUAL DNA:
{visual_dna_json}

BRAND PROFILE:
{brand_profile_json}

NEGATIVE PATTERNS (avoid these in all briefs):
{negative_patterns_json}

Produce exactly 4 briefs — one of each type: on-brand, trend-forward, audience-first, the-bet. Each must be genuinely different from the others.
```

---

## 5. Services — Fonksiyonlar ve Mantık

**Dosya:** `apps/fingerprint/services.py`

### Yeni API Wrapper

```python
def _call_web_search_api(system_prompt: str, user_prompt: str) -> str:
    """fal.ai openrouter/enterprise + enable_web_search=True."""
    _set_fal_key()
    result = fal_client.subscribe(
        "openrouter/router/enterprise",
        arguments={
            "system_prompt"    : system_prompt,
            "prompt"           : user_prompt,
            "model"            : "anthropic/claude-sonnet-5",
            "enable_web_search": True,
            "temperature"      : 0.3,
        },
    )
    return result["output"]
```

### Agent 1 — Market Analyst

```python
def _run_market_analyst(campaign) -> MarketInsightOutput | None:
    """
    Synchronous Agent 1 call. Returns parsed output or None.
    Retries once on parse failure.
    """
    fp = BrandFingerprint.objects.filter(workspace=campaign.workspace).first()
    brand_tone = ", ".join(fp.brand_profile.get("brand_tone_keywords", [])[:5]) if fp else "not specified"

    user_prompt = MARKET_ANALYST_USER_PROMPT_TEMPLATE.format(
        target_audience = campaign.target_audience or "general adult iGaming audience",
        target_region   = campaign.target_region   or "global",
        objective       = campaign.get_objective_display() or "general campaign",
        campaign_brief  = campaign.campaign_brief  or "none provided",
        brand_tone      = brand_tone,
    )

    for attempt in range(1, 3):
        try:
            raw  = _call_web_search_api(MARKET_ANALYST_SYSTEM_PROMPT, user_prompt)
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


def _market_research_worker(campaign_id: int):
    """Background worker — Agent 1. Auto-triggers Agent 2 on success."""
    from apps.brand_kit.models import Campaign
    try:
        campaign = Campaign.objects.select_related('workspace').get(id=campaign_id)
        insight, _ = CampaignMarketInsight.objects.get_or_create(
            campaign=campaign,
            defaults={'workspace': campaign.workspace}
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
            insight.error  = 'Agent 1 returned no output'
        insight.save()

        # Auto-trigger Creative Director if fingerprint has visual_dna
        if result:
            fp = BrandFingerprint.objects.filter(workspace=campaign.workspace).first()
            if fp and fp.visual_dna:
                trigger_creative_director(campaign_id)

    except Exception as exc:
        logger.error("campaign_intel.market_research_worker_failed campaign_id=%s: %s", campaign_id, exc)


def trigger_market_research(campaign_id):
    """Fire-and-forget — Agent 1."""
    threading.Thread(target=_market_research_worker, args=(campaign_id,), daemon=True).start()
```

### Agent 2 — Creative Director

```python
def _run_creative_director(campaign, insight: CampaignMarketInsight) -> CreativeBriefOutput | None:
    fp = BrandFingerprint.objects.filter(workspace=campaign.workspace).first()

    user_prompt = CREATIVE_DIRECTOR_USER_PROMPT_TEMPLATE.format(
        target_audience        = campaign.target_audience or "general",
        target_region          = campaign.target_region   or "global",
        objective              = campaign.get_objective_display() or "general",
        campaign_brief         = campaign.campaign_brief  or "none provided",
        market_research_json   = json.dumps(insight.report, ensure_ascii=False),
        visual_dna_json        = json.dumps(fp.visual_dna       if fp else {}, ensure_ascii=False),
        brand_profile_json     = json.dumps(fp.brand_profile    if fp else {}, ensure_ascii=False),
        negative_patterns_json = json.dumps(fp.negative_patterns if fp else {}, ensure_ascii=False),
    )

    for attempt in range(1, 3):
        try:
            raw  = _call_text_api(CREATIVE_DIRECTOR_SYSTEM_PROMPT, user_prompt)
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
    from apps.brand_kit.models import Campaign
    try:
        campaign = Campaign.objects.select_related('workspace').get(id=campaign_id)
        insight  = CampaignMarketInsight.objects.filter(
            campaign=campaign, status='ready'
        ).first()
        if not insight:
            logger.warning("campaign_intel.no_ready_insight campaign_id=%s", campaign_id)
            return

        fp         = BrandFingerprint.objects.filter(workspace=campaign.workspace).first()
        fp_version = fp.visual_dna_version if fp else 0

        brief_obj = CampaignCreativeBrief.objects.create(
            campaign=campaign, workspace=campaign.workspace,
            market_insight=insight, fingerprint_version=fp_version,
            status='pending',
        )

        result = _run_creative_director(campaign, insight)
        if result:
            brief_obj.briefs = [b.model_dump(mode='json') for b in result.briefs]
            brief_obj.status = 'ready'
        else:
            brief_obj.status = 'failed'
            brief_obj.error  = 'Agent 2 returned no output'
        brief_obj.save()
        logger.info("campaign_intel.agent2_done campaign_id=%s briefs=%d",
                    campaign_id, len(brief_obj.briefs))

    except Exception as exc:
        logger.error("campaign_intel.creative_director_worker_failed campaign_id=%s: %s", campaign_id, exc)


def trigger_creative_director(campaign_id):
    """Fire-and-forget — Agent 2."""
    threading.Thread(target=_creative_director_worker, args=(campaign_id,), daemon=True).start()
```

---

## 6. API Endpoints ve Views

### `apps/fingerprint/urls.py` — eklenenler

```python
path('campaign/<uuid:campaign_id>/intel/',   CampaignIntelView.as_view()),
path('campaign/<uuid:campaign_id>/research/', CampaignResearchView.as_view()),
path('campaign/<uuid:campaign_id>/briefs/',   CampaignBriefsView.as_view()),
```

### Endpoint Tablosu

| Endpoint | Method | Ne Döner | Yan Etki |
|----------|--------|----------|----------|
| `/api/fingerprint/campaign/<id>/intel/` | GET | Insight status + brief count + özet liste | — |
| `/api/fingerprint/campaign/<id>/research/` | POST | `{status: "queued"}` | Agent 1 → biter → Agent 2 |
| `/api/fingerprint/campaign/<id>/briefs/` | GET | En güncel ready brief seti (tam veri) | — |
| `/api/fingerprint/campaign/<id>/briefs/` | POST | `{status: "queued"}` | Sadece Agent 2 (insight hazır olmalı) |

### GET `/intel/` Response Shape

```json
{
  "campaign_id"        : "uuid",
  "has_audience"       : true,
  "research_status"    : "ready",
  "research_updated_at": "ISO datetime",
  "brief_status"       : "ready",
  "brief_count"        : 4,
  "fingerprint_stale"  : false,
  "briefs_summary": [
    {
      "id"        : "brief_1",
      "type"      : "on-brand",
      "title"     : "...",
      "concept"   : "...",
      "confidence": "high"
    }
  ]
}
```

> `fingerprint_stale`: mevcut BrandFingerprint.visual_dna_version vs en son CampaignCreativeBrief.fingerprint_version karşılaştırması.

---

## 7. Frontend Değişiklikleri

### 1. Campaign Oluşturma / Düzenleme Formu

Brand Kit içindeki mevcut campaign modaline 4 yeni alan:

| Alan | Bileşen | Zorunlu? | Not |
|------|---------|----------|-----|
| `target_audience` | textarea | Hayır | "18-35 erkek spor fanı, mobil ağırlıklı" |
| `target_region` | text input | Hayır | "Turkey", "UK", "MENA" |
| `objective` | select | Hayır | Acquisition / Retention / Awareness / Reactivation / Event |
| `campaign_brief` | textarea | Hayır | Serbest metin, insan tarafından |

> Bu alanlar doldurulmamış olsa bile kampanya çalışmaya devam etmeli. Intel sistemi sadece doluysa devreye girer.

### 2. `api.js` — Yeni Çağrılar

```js
export const fingerprintApi = {
  // mevcut...
  status  : () => request('GET',  '/fingerprint/status/'),
  merge   : () => request('POST', '/fingerprint/merge/'),
  recreate: () => request('POST', '/fingerprint/recreate/'),

  // YENİ
  campaignIntel   : (id) => request('GET',  `/fingerprint/campaign/${id}/intel/`),
  campaignResearch: (id) => request('POST', `/fingerprint/campaign/${id}/research/`),
  campaignBriefs  : (id) => request('GET',  `/fingerprint/campaign/${id}/briefs/`),
  campaignRebriefs: (id) => request('POST', `/fingerprint/campaign/${id}/briefs/`),
};
```

### 3. Generate V2 — Campaign Seçilince Akış

Campaign dropdown'da bir kampanya seçildiğinde `fingerprintApi.campaignIntel(id)` çağrılır.

**Durum → UI:**

| research_status | brief_status | Gösterim |
|-----------------|--------------|----------|
| null | — | "💡 Bu kampanya için araştırma başlat" butonu |
| pending | — | Spinner + "Araştırılıyor… (~20-30 sn)" |
| ready | pending | Spinner + "Brief hazırlanıyor…" |
| ready | ready | 4 brief kartı |
| failed | — | Hata + "Tekrar dene" |

> Hedef kitle/bölge boşsa: "Bu kampanya için hedef kitle ve bölge eklersen size özel araştırma yapabilirim" — Brand Kit'e link.

### 4. Brief Kartı Anatomisi

```
┌─────────────────────────────────┐
│ [On-Brand]              [HIGH]  │  ← type chip + confidence
│                                 │
│ "Güçlü Başlık 3-5 Kelime"       │
│ Tek cümle konsept metni…        │
│                                 │
│ ▸ Trend → [collapsed detay]     │
│ ▸ Brand fit → [collapsed]       │
│                                 │
│            [ Bunu Seç ]         │
└─────────────────────────────────┘
```

**Kart seçilince:**
- `extra_prompt` state'i dolar
- Fingerprint toggle otomatik açılır
- `hero_element` + `color_direction` detayları gösterilir

**Renk kodları:** on-brand → mavi · trend-forward → amber · audience-first → yeşil · the-bet → mor

> ⚠️ `fingerprint_stale = true` ise brief kartlarının üstünde sarı banner: "Fingerprint güncellendi. Briefs eski olabilir — yenile?" + "Yenile" butonu → `campaignRebriefs()`

---

## 8. Migration ve Deploy

### Adımlar

1. **Campaign modeline 4 alan ekle** — `apps/brand_kit/models.py`
2. **fingerprint/models.py'ye 2 model ekle** — `CampaignMarketInsight`, `CampaignCreativeBrief`; `admin.py`'ye de kaydet
3. **makemigrations + migrate**
   ```bash
   cd /home/ubuntu/troxa-beta/backend
   venv/bin/python manage.py makemigrations brand_kit
   venv/bin/python manage.py makemigrations fingerprint
   venv/bin/python manage.py migrate
   ```
4. **`fingerprint/schemas.py`** — `MarketInsightOutput`, `CreativeBriefOutput` ekle
5. **`fingerprint/prompts.py`** — 4 yeni sabit ekle (sistem promptları)
6. **`fingerprint/services.py`** — yeni fonksiyonlar: `_call_web_search_api`, `_run_market_analyst`, `_market_research_worker`, `trigger_market_research`, `_run_creative_director`, `_creative_director_worker`, `trigger_creative_director`
7. **`fingerprint/views.py` + `urls.py`** — 3 yeni view
8. **`brand_kit` views/serializers** — Campaign CRUD'a yeni alanlar eklenmeli
9. **Gunicorn restart**
   ```bash
   sudo systemctl restart troxa-gunicorn.service
   ```
10. **Frontend** — Campaign formu, `api.js`, Generate V2 brief kartları
11. **Build + serve**
    ```bash
    cd /home/ubuntu/troxa-beta/FrontendRework && npm run build
    ```

### Özet

| | |
|---|---|
| Yeni dosyalar | `schemas.py` içine 2 schema, `models.py` içine 2 model, 2 migration |
| Değiştirilen dosyalar | `models.py` (brand_kit), `services.py`, `views.py`, `urls.py`, `prompts.py`, `api.js`, `GenerateCreativesV2.jsx`, `BrandKit.jsx` |
| Toplam yeni servis fonksiyonu | 7 |
| Toplam yeni API endpoint | 4 |
| Toplam yeni prompt sabiti | 4 |
