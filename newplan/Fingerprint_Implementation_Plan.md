# Fingerprint Sistemi — Python/Django Implementation Plan

Bu dosya [Fingerprint_Kararlar.md](Fingerprint_Kararlar.md)'da alınan kararları **Django + PostgreSQL** üzerinde nasıl kodlayacağımızı anlatıyor. Model olarak tüm agent'larda **`claude-sonnet-5`** kullanılıyor (orijinal tasarımın adı zaten "Sonnet 5 Sistem Promptları").

**Kritik mimari karar:** Tüm agent'lar için Anthropic Python SDK'nın `client.messages.parse()` metodunu kullanıyoruz — Pydantic modeli veriyorsunuz, SDK JSON şemasını modele zorluyor (`output_config.format`) ve doğrulanmış bir Python objesi (`response.parsed_output`) döndürüyor. Bu, Kararlar.md §9'daki "LLM'den bozuk JSON gelirse" riskini büyük ölçüde ortadan kaldırıyor — manuel `json.loads` + şema doğrulama yazmamıza gerek kalmıyor, SDK zaten şemayı garanti ediyor.

---

## 0. Agent'ların çalışma sırası — kim kimi tetikliyor

**Bu 5 agent sıralı bir pipeline değil.** Tek bir ortak "durum" objesi var — `BrandFingerprint` — ve 4 agent ona **yazıyor**, 1 agent (Agent 3) sadece ondan **okuyor**. Kullanıcı "üret" dediği anda sadece Agent 3 çalışır; diğer 4'ü hiç beklemez, çünkü arka planda `BrandFingerprint`'i zaten güncel tutmuşlardır.

```
                    ┌───────────────────────────────┐
                    │   BrandFingerprint (DB, tek)   │
                    │  brand_profile        ← Agent 2 │
                    │  visual_dna           ← Sentez/Agent4 │
                    │  negative_patterns    ← Sentez/Agent4 │
                    └───────────────┬─────────────────┘
                                    │ okunur
                                    ▼
  Kullanıcı "üret" dedi ──────> AGENT 3 (SENKRON) ──> final prompt ──> fal.ai
                                    ▲
                    ┌───────────────┴────────────────┐
                    │                                  │
             Brand kit değişti                 visual_dna / negative_patterns güncellenir
                    │                                  │
                    ▼                        ┌─────────┴─────────┐
              AGENT 2 (async)                 │                    │
                                      AGENT 4 (merge)       SENTEZ (recreate)
                                      24h / hacim eşiği     manuel buton VEYA
                                      → mevcut+yeni veriyi   Agent4'ün drift_flag
                                        harmanlar              → TÜM corpus'tan sıfırdan
                                            ▲                        ▲
                                            └────────────┬───────────┘
                                                          │ okur
                                              ImageAnalysisRecord (corpus)
                                                          ▲
                                                    AGENT 1 (async)
                                          galeri yüklemesi / üretim puanlandı
```

| # | Agent | Ne zaman tetiklenir | Neyi okur | Neyi yazar | Sync? |
|---|---|---|---|---|---|
| 1 | Agent 1 (Görsel Analiz) | Galeriye görsel yüklendi VEYA üretim puanlandı | Tek görsel | Yeni bir `ImageAnalysisRecord` satırı (corpus'a ekler) | Async |
| 2 | Agent 2 (Brand Kit) | Logo/renk/font/CTA/promo değişti | Brand kit verisi | `BrandFingerprint.brand_profile` | Async |
| 3 | Agent 4 (Merge) | 24 saat geçti VEYA günlük hacim eşiği aşıldı | Mevcut fingerprint + Agent 1'in ürettiği **henüz işlenmemiş** kayıtlar (delta) | `visual_dna` + `negative_patterns` (üstüne harmanlar) | Async |
| 4 | Sentez (Recreate) | Manuel "recreate" butonu VEYA Agent 4 `drift_flag=true` döndürdü | Workspace'in **tüm** corpus'u | `visual_dna` + `negative_patterns` (sıfırdan) | Async |
| 5 | Agent 3 (Prompt Üretim) | Kullanıcı "üret" dedi | Güncel `BrandFingerprint`'in tamamı | Hiçbir şeyi güncellemez — sadece final prompt üretir | **Senkron** |

**Bağımlılık zinciri, açıkça:**
- Agent 1 doğrudan Agent 3'e gitmez — önce corpus'a (`ImageAnalysisRecord`) düşer.
- Agent 4 ve Sentez **aynı alanları** yazar: Agent 4 "ucuz/sık" güncelleyici (delta ile), Sentez "pahalı/nadir" tam yeniden hesaplama (tüm corpus ile). Agent 4 kendi kararıyla (`drift_flag`) Sentez'i tetikleyebilir; Sentez Agent 4'ü asla tetiklemez.
- Agent 2 tamamen bağımsız bir hat — Agent 1/4/Sentez'le hiç etkileşmez, sadece `brand_profile`'ı günceller.
- Agent 3, diğer 4 agent'ın ürettiği **son durumu** okur — kendisi hiçbir agent'ı tetiklemez, hiçbir şeyi güncellemez.

Aşağıdaki bölümler (§1-14) her agent'ın **kod implementasyonunu** tek tek anlatıyor — sıra numaraları (Agent 1→2→3→4) bu diyagramdaki çalışma sırasını değil, sadece anlatım sırasını yansıtıyor.

---

## 1. Django app yapısı

```
apps/fingerprint/
├── models.py                  # BrandFingerprint, ImageAnalysisRecord
├── schemas.py                 # Her agent için Pydantic output modelleri
├── prompts.py                 # SYSTEM_PROMPT sabitleri
├── services/
│   ├── client.py               # Anthropic client wrapper
│   ├── images.py                # Görsel -> base64 dönüştürme yardımcıları
│   ├── agent1_image_analysis.py
│   ├── agent2_brand_kit.py
│   ├── agent3_prompt_generation.py     # SENKRON
│   ├── agent4_merge.py
│   └── synthesis_recreate.py           # Tam yeniden hesaplama ("recreate")
├── tasks.py                    # Celery task'ları (async agent'lar + tetikleyiciler)
├── signals.py                  # Django signal receiver'ları (yeni görsel, rating, brand kit)
└── api/
    ├── views.py                 # generate_prompt endpoint'i (Agent 3'ü senkron çağırır), recreate endpoint'i
    └── serializers.py
```

---

## 2. Ortak altyapı

### 2.1 Anthropic client

```python
# apps/fingerprint/services/client.py
import anthropic
from django.conf import settings

MODEL_ID = "claude-sonnet-5"

def get_client() -> anthropic.Anthropic:
    # settings.ANTHROPIC_API_KEY .env'den okunuyor; boşsa SDK ANTHROPIC_API_KEY
    # env değişkenini otomatik okur.
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, max_retries=3)
```

`max_retries=3`: SDK zaten 429/5xx/network hatalarını üstel geri çekilmeyle otomatik tekrar dener — bizim retry mantığımız sadece "geçerli ama beklenmedik içerik" durumları için (bkz. §2.3).

### 2.2 Görsel → base64

```python
# apps/fingerprint/services/images.py
import base64
import mimetypes

def encode_image_for_claude(file_field) -> tuple[str, str]:
    """Django FileField/ImageField -> (media_type, base64_data)."""
    file_field.open("rb")
    try:
        raw = file_field.read()
    finally:
        file_field.close()
    media_type = mimetypes.guess_type(file_field.name)[0] or "image/jpeg"
    return media_type, base64.standard_b64encode(raw).decode("utf-8")
```

### 2.3 Ortak `parse` sarmalayıcı — retry + hata yönetimi

Kararlar.md §9'daki "retry + eski fingerprint korunsun" kararı burada uygulanıyor: SDK'nın kendi retry'ı transient hatalar için, bu wrapper ise "model içerik üretemedi/refuse etti" gibi durumlar için ek bir güvenlik katmanı.

```python
# apps/fingerprint/services/base.py
import logging
from pydantic import BaseModel
from anthropic import APIStatusError, APIConnectionError
from .client import get_client, MODEL_ID

logger = logging.getLogger("fingerprint.agents")


class AgentCallFailed(Exception):
    """Tüm denemeler tükendi — çağıran taraf mevcut fingerprint'i korumalı."""


def call_structured(
    *,
    system: str,
    messages: list[dict],
    output_model: type[BaseModel],
    max_tokens: int = 4096,
    effort: str = "medium",
    agent_name: str = "unknown",
    max_attempts: int = 2,
):
    """Her agent'ın ortak çağrı noktası. output_model bir Pydantic BaseModel'dir;
    SDK, output_config.format'ı bu modelden otomatik türetir ve response.parsed_output
    zaten doğrulanmış bir output_model örneği olarak döner."""
    client = get_client()
    last_error = None

    for attempt in range(1, max_attempts + 1):
        try:
            response = client.messages.parse(
                model=MODEL_ID,
                max_tokens=max_tokens,
                system=system,
                messages=messages,
                output_config={"effort": effort},
                output_format=output_model,
            )
        except (APIStatusError, APIConnectionError) as exc:
            last_error = exc
            logger.warning(
                "fingerprint.agent_call_error",
                extra={"agent": agent_name, "attempt": attempt, "error": str(exc)},
            )
            continue

        if response.stop_reason == "refusal":
            last_error = RuntimeError(f"refused: {response.stop_details}")
            logger.warning(
                "fingerprint.agent_refusal",
                extra={"agent": agent_name, "attempt": attempt},
            )
            continue

        if response.parsed_output is None:
            last_error = RuntimeError("parsed_output is None (max_tokens too low?)")
            continue

        return response.parsed_output

    logger.error(
        "fingerprint.agent_call_exhausted",
        extra={"agent": agent_name, "attempts": max_attempts, "error": str(last_error)},
    )
    raise AgentCallFailed(f"{agent_name} failed after {max_attempts} attempts: {last_error}")
```

Çağıran task'lar `AgentCallFailed` yakaladığında **mevcut fingerprint'e dokunmaz**, hatayı loglar, bir sonraki tetikte tekrar dener — Kararlar.md §9'daki karar.

---

## 3. Veritabanı şeması (PostgreSQL / Django ORM)

```python
# apps/fingerprint/models.py
from django.db import models
from django.utils import timezone


class BrandFingerprint(models.Model):
    CONFIDENCE_CHOICES = [("low", "low"), ("medium", "medium"), ("high", "high")]

    workspace = models.OneToOneField(
        "workspaces.Workspace", on_delete=models.CASCADE, related_name="fingerprint"
    )

    brand_profile = models.JSONField(default=dict, blank=True)       # Agent 2 çıktısı
    brand_profile_version = models.PositiveIntegerField(default=0)

    visual_dna = models.JSONField(default=dict, blank=True)          # Sentez/Agent4 çıktısı
    negative_patterns = models.JSONField(default=dict, blank=True)   # Sentez/Agent4 çıktısı
    visual_dna_version = models.PositiveIntegerField(default=0)
    confidence = models.CharField(max_length=10, choices=CONFIDENCE_CHOICES, default="low")
    based_on_image_count = models.PositiveIntegerField(default=0)

    compliance_requirements = models.JSONField(default=dict, blank=True)  # deterministik, kullanıcı seçimi
    brand_kit_version = models.PositiveIntegerField(default=0)

    last_full_recreate_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "fingerprint_brandfingerprint"


class ImageAnalysisRecord(models.Model):
    """Corpus — tam ham veri. Manuel 'recreate' bunun TAMAMINI kullanır,
    Agent 4 (merge) ise sadece included_in_fingerprint_version alanı boş
    olanları (delta) kullanır."""

    SOURCE_GALLERY = "gallery"
    SOURCE_GENERATION = "generation"
    SOURCE_CHOICES = [(SOURCE_GALLERY, "Gallery upload"), (SOURCE_GENERATION, "Generation result")]

    SENTIMENT_POSITIVE = "positive"
    SENTIMENT_NEUTRAL = "neutral"
    SENTIMENT_NEGATIVE = "negative"
    SENTIMENT_CHOICES = [
        (SENTIMENT_POSITIVE, "Positive"),
        (SENTIMENT_NEUTRAL, "Neutral"),
        (SENTIMENT_NEGATIVE, "Negative"),
    ]

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.CASCADE, related_name="fingerprint_corpus"
    )
    image = models.ForeignKey("media.MediaAsset", on_delete=models.CASCADE)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    generation = models.ForeignKey(
        "generations.Generation", null=True, blank=True, on_delete=models.SET_NULL
    )
    rating = models.PositiveSmallIntegerField(null=True, blank=True)  # 1-10; galeri yüklemesi=None
    sentiment = models.CharField(max_length=10, choices=SENTIMENT_CHOICES, default=SENTIMENT_POSITIVE)

    analysis = models.JSONField()  # Agent 1 çıktısı (ImageAnalysisOutput.model_dump())

    # Delta işaretçisi: Agent 4 hangi kayıtları henüz harmanlamadı?
    included_in_fingerprint_version = models.PositiveIntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "fingerprint_imageanalysisrecord"
        indexes = [
            models.Index(fields=["workspace", "included_in_fingerprint_version"]),
        ]

    def save(self, *args, **kwargs):
        if self.rating is not None:
            if self.rating >= 7:
                self.sentiment = self.SENTIMENT_POSITIVE
            elif self.rating <= 4:
                self.sentiment = self.SENTIMENT_NEGATIVE
            else:
                self.sentiment = self.SENTIMENT_NEUTRAL
        super().save(*args, **kwargs)
```

`analysis` ve `brand_profile`/`visual_dna`/`negative_patterns` alanları PostgreSQL'in native `jsonb` tipine map'lenir (Django `JSONField` Postgres backend'de otomatik `jsonb` kullanır) — hem hızlı hem de gerekirse `analysis__style_tags__contains` gibi sorgulara açık.

---

## 4. Pydantic şemaları — `schemas.py`

Bunlar hem `client.messages.parse()`'a `output_format` olarak veriliyor hem de veritabanına yazılan JSON'ın şeklini garanti ediyor.

```python
# apps/fingerprint/schemas.py
from pydantic import BaseModel, Field
from typing import Literal


# ---- Agent 1: Görsel Analiz ----

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
    headline_text: str | None
    body_text: str | None
    font_style_description: str
    text_placement: str


class BrandingElements(BaseModel):
    logo_visible: bool
    logo_description: str | None
    cta_visible: bool
    cta_text: str | None
    cta_style: str | None
    promo_badge: str | None


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


# ---- Agent 2: Brand Kit Analiz ----

class LogoInfo(BaseModel):
    visual_description: str
    color_role: str


class ColorPaletteInfo(BaseModel):
    primary: list[ColorEntry]
    secondary: list[ColorEntry]
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


# ---- Sentez (recreate) ve Agent 4 (merge) ortak çıktı parçaları ----

class VisualDna(BaseModel):
    recurring_art_style: str
    recurring_composition_patterns: str
    dominant_color_tendencies: list[ColorEntry]
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
    """Sentez agent (tam recreate) çıktısı."""
    visual_dna: VisualDna
    negative_patterns: NegativePatterns
    confidence: ConfidenceLevel
    based_on_image_count: int


class MergeOutput(BaseModel):
    """Agent 4 (harmanlama) çıktısı."""
    visual_dna: VisualDna
    negative_patterns: NegativePatterns
    confidence: ConfidenceLevel
    changelog: str
    drift_flag: bool


# ---- Agent 3: Prompt Üretim ----

class PromptGenerationOutput(BaseModel):
    prompt: str
    negative_prompt: str
    notes: str
```

`headline_text: str | None` gibi alanlar Pydantic'te `Optional` olarak tanımlanınca SDK bunu JSON Schema'da `{"type": ["string", "null"]}` şeklinde otomatik türetiyor — `output_config.format`'ın desteklediği nullable şekil bu.

---

## 5. Agent 1 — Görsel Analiz Ajanı

```python
# apps/fingerprint/prompts.py

# SYSTEM — Fingerprint_Agent_Tasarimi.md'deki tam metin, birebir. output_config.format
# zaten şemayı programatik olarak zorluyor ama Schema bloğunu ve "output valid JSON
# only" talimatını promptun içinden de ÇIKARMIYORUZ — bu, tasarımın orijinali ve
# kasıtlı bir "belt-and-suspenders" (çift güvence): model şemayı hem prompt
# metninden hem API seviyesinden görüyor, biri diğerini geçersiz kılmıyor.
AGENT1_SYSTEM_PROMPT = """You are a visual analysis specialist for advertising creative. You will be shown a
single advertising image (a betting/sportsbook or casino ad static). Analyze it in
full visual detail and return ONLY a JSON object matching this schema — no prose,
no markdown fences, no explanation outside the JSON.

Schema:
{
  "art_style": string,
  "subject": {
    "main_subject": string,
    "secondary_elements": [string]
  },
  "composition": {
    "layout": string,
    "framing": string,
    "focal_point": string,
    "visual_hierarchy": string
  },
  "color_profile": {
    "dominant_colors": [{"hex": string, "name": string, "role": string}],
    "contrast": string,
    "mood": string
  },
  "lighting": string,
  "background": string,
  "typography_in_image": {
    "headline_text": string | null,
    "body_text": string | null,
    "font_style_description": string,
    "text_placement": string
  },
  "branding_elements": {
    "logo_visible": boolean,
    "logo_description": string | null,
    "cta_visible": boolean,
    "cta_text": string | null,
    "cta_style": string | null,
    "promo_badge": string | null
  },
  "style_tags": [string],
  "recreate_prompt": string
}

Rules:
- "recreate_prompt" must be a single dense paragraph, self-contained, written as a
  standalone text-to-image prompt — detailed enough that a T2I model with no other
  context could reproduce a near-identical image. Include medium, subject,
  composition, colors (by descriptive name), lighting, background, mood, and any
  visible text content verbatim. Write it as a generation instruction, never as a
  description of "the image".
- If exact colors can't be determined, give the closest named color plus an
  approximate hex.
- Never invent brand names or details not visible in the image.
- Output valid JSON only."""

# USER — bu görevin somut talimatı. Her çağrıda aynı metin (görsel değişken), ama
# system'den ayrı tutuluyor ki "şu an ne yapman isteniyor" net olsun.
AGENT1_USER_PROMPT = """Below is a single advertising creative (a betting/sportsbook or casino ad static).

Analyze it in full visual detail and describe what you actually see in it —
do not guess at things that are not visible. Pay particular attention to:
- Any visible text (headline, body, CTA, promo badge) — transcribe it verbatim.
- The exact composition and how the eye is guided through the image.
- Colors as they actually appear in this specific image, not idealized/generic
  brand colors.

Produce your analysis according to the schema you have been given."""
```

```python
# apps/fingerprint/services/agent1_image_analysis.py
from ..schemas import ImageAnalysisOutput
from ..prompts import AGENT1_SYSTEM_PROMPT, AGENT1_USER_PROMPT
from .base import call_structured
from .images import encode_image_for_claude


def analyze_image(media_asset) -> ImageAnalysisOutput:
    media_type, b64 = encode_image_for_claude(media_asset.file)
    messages = [{
        "role": "user",
        "content": [
            {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
            {"type": "text", "text": AGENT1_USER_PROMPT},
        ],
    }]
    return call_structured(
        system=AGENT1_SYSTEM_PROMPT,
        messages=messages,
        output_model=ImageAnalysisOutput,
        max_tokens=2048,
        effort="medium",
        agent_name="agent1_image_analysis",
    )
```

**Tetikleyici:** Celery task, senkron olarak çağrılmaz (görsel/vision çağrısı yavaş).

```python
# apps/fingerprint/tasks.py (parça 1)
from celery import shared_task
from django.utils import timezone
from .models import ImageAnalysisRecord
from .services.agent1_image_analysis import analyze_image
from .services.base import AgentCallFailed


@shared_task(bind=True, max_retries=2, default_retry_delay=60, queue="fingerprint")
def run_agent1_for_record(self, record_id: int):
    record = ImageAnalysisRecord.objects.select_related("image").get(pk=record_id)
    try:
        result = analyze_image(record.image)
    except AgentCallFailed as exc:
        # Kararlar.md §9: mevcut veri korunur, tekrar denenir (Celery retry).
        raise self.retry(exc=exc)

    record.analysis = result.model_dump(mode="json")
    record.save(update_fields=["analysis"])

    _maybe_trigger_early_merge(record.workspace_id)
```

---

## 6. Agent 2 — Marka Kiti Analiz Ajanı

```python
# SYSTEM — Fingerprint_Agent_Tasarimi.md'deki tam metin, birebir.
AGENT2_SYSTEM_PROMPT = """You are a brand identity analyst. You will be given a brand's raw kit assets: a
logo image, a list of brand colors (hex codes), font information, sample CTA
texts, and sample promo texts. Synthesize these into a single JSON brand profile
— no prose outside JSON.

Schema:
{
  "logo": {
    "visual_description": string,
    "color_role": string
  },
  "color_palette": {
    "primary": [{"hex": string, "name": string}],
    "secondary": [{"hex": string, "name": string}],
    "usage_notes": string
  },
  "typography": {
    "primary_font_style": string,
    "usage_notes": string
  },
  "cta_style": {
    "tone": string,
    "common_phrasing_pattern": string,
    "visual_style": string
  },
  "promo_style": {
    "tone": string,
    "common_themes": [string],
    "sample_summary": string
  },
  "brand_tone_keywords": [string]
}

Rules:
- Base every field strictly on the provided assets; do not fabricate palette
  entries that were not given.
- Phrase every description in concrete visual language that can be reused
  directly inside a future image-generation prompt — not marketing fluff.
- Output valid JSON only."""

# USER — şablon; gerçek kit verisi her çağrıda .format() ile dolduruluyor.
AGENT2_USER_PROMPT_TEMPLATE = """Below is this brand's raw kit — synthesize it into a single, reusable visual
identity profile. The logo is attached as an image.

Brand colors (hex): {color_hex_list}
Font family: {font_family}
Sample CTA texts:
{sample_cta_texts}
Sample promo texts:
{sample_promo_texts}

Base every field strictly on what is given above and visible in the logo
image — do not add palette entries, fonts, or tones that aren't represented
in this material."""
```

```python
# apps/fingerprint/services/agent2_brand_kit.py
from ..schemas import BrandProfileOutput
from ..prompts import AGENT2_SYSTEM_PROMPT, AGENT2_USER_PROMPT_TEMPLATE
from .base import call_structured
from .images import encode_image_for_claude


def analyze_brand_kit(brand_kit) -> BrandProfileOutput:
    media_type, b64 = encode_image_for_claude(brand_kit.logo_file)
    user_text = AGENT2_USER_PROMPT_TEMPLATE.format(
        color_hex_list=brand_kit.color_hex_list,
        font_family=brand_kit.font_family,
        sample_cta_texts=brand_kit.sample_cta_texts,
        sample_promo_texts=brand_kit.sample_promo_texts,
    )
    messages = [{
        "role": "user",
        "content": [
            {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
            {"type": "text", "text": user_text},
        ],
    }]
    return call_structured(
        system=AGENT2_SYSTEM_PROMPT,
        messages=messages,
        output_model=BrandProfileOutput,
        max_tokens=1536,
        agent_name="agent2_brand_kit",
    )
```

**Tetikleyici:** `BrandKit` modelinin `post_save` sinyali (logo/renk/font/CTA/promo değiştiğinde).

```python
# apps/fingerprint/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from brandkit.models import BrandKit
from .tasks import run_agent2_for_brand_kit


@receiver(post_save, sender=BrandKit)
def on_brand_kit_updated(sender, instance, **kwargs):
    run_agent2_for_brand_kit.delay(instance.id)
```

```python
@shared_task(bind=True, max_retries=2, default_retry_delay=60, queue="fingerprint")
def run_agent2_for_brand_kit(self, brand_kit_id: int):
    from brandkit.models import BrandKit
    from .models import BrandFingerprint
    from .services.agent2_brand_kit import analyze_brand_kit
    from .services.base import AgentCallFailed

    brand_kit = BrandKit.objects.get(pk=brand_kit_id)
    try:
        result = analyze_brand_kit(brand_kit)
    except AgentCallFailed as exc:
        raise self.retry(exc=exc)

    fp, _ = BrandFingerprint.objects.get_or_create(workspace_id=brand_kit.workspace_id)
    fp.brand_profile = result.model_dump(mode="json")
    fp.brand_profile_version += 1
    fp.brand_kit_version = brand_kit.version
    fp.save(update_fields=["brand_profile", "brand_profile_version", "brand_kit_version", "updated_at"])
```

---

## 7. Sentez Agent — Tam Yeniden Hesaplama ("recreate")

```python
# SYSTEM — Fingerprint_Kararlar.md §3'teki tam metin, birebir.
SYNTHESIS_SYSTEM_PROMPT = """You are synthesizing a brand's recurring visual style — and its recurring
"avoid" patterns — from the full set of individual image analyses of its past
creatives (both reference gallery uploads and past generations). You will
receive a JSON array of per-image analysis objects (each with art_style,
composition, color_profile, lighting, background, typography_in_image,
style_tags), and a raw user rating from 1-10 for entries that came from rated
generations (reference gallery uploads may have no rating field).

Rating interpretation — use the raw score for nuanced weighting, never collapse
it into a flat "good/bad" bucket:
- 7-10: positive evidence for recurring_* fields; weight increases with the
  score (a 10 counts more than a 7).
- 5-6: neutral/weak evidence — barely shifts either recurring_* fields or
  negative_patterns.
- 1-4: evidence for negative_patterns; weight increases as the score drops (a 1
  counts more than a 4).
- No rating (raw gallery upload): treat as strong positive evidence — the user
  explicitly chose this as a reference/successful example.

Output a single JSON:
{
  "visual_dna": {
    "recurring_art_style": string,
    "recurring_composition_patterns": string,
    "dominant_color_tendencies": [{"hex": string, "name": string}],
    "recurring_lighting_mood": string,
    "recurring_background_style": string,
    "typography_tendencies": string,
    "style_tags_ranked": [string],
    "summary_style_dna": string
  },
  "negative_patterns": {
    "recurring_avoid_elements": [string],
    "avoid_style_tags": [string],
    "summary_negative_dna": string
  },
  "confidence": "low" | "medium" | "high",
  "based_on_image_count": int
}

Rules:
- confidence = "low" if based on fewer than 5 images total, "medium" for
  5-15, "high" for 15+.
- "summary_style_dna" and "summary_negative_dna" must each be 2-4 sentence
  natural-language descriptions written so they can be dropped directly into a
  future generation prompt — style_dna as positive flavoring, negative_dna as
  soft things to lean away from.
- If the data is too sparse or inconsistent to find a real pattern in either
  direction, say so honestly in the relevant fields rather than overfitting to
  a handful of images.
- Never invent details not present in the input analyses.
- Output valid JSON only."""

# USER — şablon; gerçek corpus her çağrıda .format() ile dolduruluyor.
SYNTHESIS_USER_PROMPT_TEMPLATE = """Below is the full corpus of this brand's past creatives — {count} images in
total, each with its per-image analysis and (if available) a user rating from
1-10.

CORPUS:
{corpus_json}

Identify the recurring visual patterns for visual_dna, and the recurring
elements that show up in low-rated entries for negative_patterns, following
the rating-interpretation rules you have been given."""
```

```python
# apps/fingerprint/services/synthesis_recreate.py
import json
from ..schemas import SynthesisOutput
from ..prompts import SYNTHESIS_SYSTEM_PROMPT, SYNTHESIS_USER_PROMPT_TEMPLATE
from .base import call_structured
from ..models import ImageAnalysisRecord


def run_full_recreate(workspace_id: int) -> SynthesisOutput:
    records = ImageAnalysisRecord.objects.filter(workspace_id=workspace_id).values(
        "analysis", "rating"
    )
    corpus = [{"analysis": r["analysis"], "rating": r["rating"]} for r in records]

    user_text = SYNTHESIS_USER_PROMPT_TEMPLATE.format(
        count=len(corpus),
        corpus_json=json.dumps(corpus, ensure_ascii=False),
    )
    messages = [{"role": "user", "content": user_text}]
    return call_structured(
        system=SYNTHESIS_SYSTEM_PROMPT,
        messages=messages,
        output_model=SynthesisOutput,
        max_tokens=3072,
        effort="high",  # tam recreate nadiren çağrılır, kaliteye öncelik ver
        agent_name="synthesis_recreate",
    )
```

**Tetikleyici:** Manuel "recreate" butonu veya Agent 4'ün `drift_flag=True` döndürmesi.

```python
@shared_task(bind=True, max_retries=1, queue="fingerprint")
def run_full_recreate_task(self, workspace_id: int, reason: str = "manual"):
    from django.core.cache import cache
    from django.utils import timezone
    from .models import BrandFingerprint, ImageAnalysisRecord
    from .services.synthesis_recreate import run_full_recreate
    from .services.base import AgentCallFailed

    lock_key = f"fingerprint:recreate-lock:{workspace_id}"
    if not cache.add(lock_key, "locked", timeout=60 * 15):
        return  # zaten çalışıyor

    try:
        try:
            result = run_full_recreate(workspace_id)
        except AgentCallFailed as exc:
            raise self.retry(exc=exc)

        fp = BrandFingerprint.objects.select_for_update()
        with transaction.atomic():
            fp = BrandFingerprint.objects.select_for_update().get(workspace_id=workspace_id)
            fp.visual_dna = result.visual_dna.model_dump(mode="json")
            fp.negative_patterns = result.negative_patterns.model_dump(mode="json")
            fp.confidence = result.confidence
            fp.based_on_image_count = result.based_on_image_count
            fp.visual_dna_version += 1
            fp.last_full_recreate_at = timezone.now()
            fp.save()

            # Delta işaretçisini sıfırla: her şey artık bu versiyona dahil edildi
            ImageAnalysisRecord.objects.filter(workspace_id=workspace_id).update(
                included_in_fingerprint_version=fp.visual_dna_version
            )
    finally:
        cache.delete(lock_key)
```

`select_for_update()` + `transaction.atomic()`: Aynı workspace için eşzamanlı iki güncelleme (ör. hem 24 saat tetikleyici hem manuel recreate) çakışmasın diye satır kilidi — bu, Kararlar.md §9'daki "lock/idempotency mekanizması" gereksinimini karşılıyor (Celery `cache.add` lock'una ek bir DB seviyesi güvence).

---

## 8. Agent 4 — Harmanlama (Merge) Ajanı

```python
# SYSTEM — Fingerprint_Kararlar.md §4'teki tam metin, birebir.
MERGE_SYSTEM_PROMPT = """You are updating an existing brand visual fingerprint with new evidence — you
are NOT starting from scratch. You will receive:

1. CURRENT_FINGERPRINT: the brand's existing synthesized visual_dna, its
   negative_patterns (style elements historically associated with low user
   ratings, if any), its confidence level, the total number of images it is
   cumulatively based on, and when it was last updated.
2. NEW_RECORDS: a JSON array of individually-analyzed images added since that
   last update. Each record includes the full per-image analysis object and a
   raw user rating from 1-10 (higher = more preferred by the user — this is a
   subjective preference signal, not a performance metric).

Rating interpretation (use the raw score for nuanced weighting, do not just
bucket it into "good/bad"):
- 7-10: positive evidence, weight increases with the score.
- 5-6: neutral/weak evidence — barely shifts anything.
- 1-4: negative evidence for negative_patterns, weight increases as the score
  drops.

Merge instructions:
- Treat CURRENT_FINGERPRINT as your prior belief. NEW_RECORDS is fresh evidence
  that should shift that belief incrementally — it does not replace it
  wholesale. A pattern built on dozens of prior images should not flip because
  of a handful of new records unless those new records are strongly and
  consistently different.
- Update confidence based on the NEW cumulative image count (prior total + the
  count of NEW_RECORDS), not just this batch — confidence must reflect all
  evidence the fingerprint has ever been built on, same thresholds as the full
  synthesis (low <5, medium 5-15, high 15+).
- Update negative_patterns the same way: recurring elements/style_tags that
  keep showing up in low-rated (1-4) records, weighted by how low the score is.
- If NEW_RECORDS meaningfully and consistently contradicts CURRENT_FINGERPRINT
  (a real stylistic shift, not noise from 2-3 records), lean the output toward
  the new evidence, but set drift_flag = true and explain the shift in
  "changelog" instead of silently overwriting an established pattern.
- If NEW_RECORDS is sparse, noisy, or doesn't add a clear signal, keep
  CURRENT_FINGERPRINT's fields close to unchanged and say so honestly in
  changelog — do not manufacture a new pattern out of a couple of records.
- Never invent details not present in either CURRENT_FINGERPRINT or
  NEW_RECORDS.

Output strictly as JSON, nothing else:
{
  "visual_dna": {
    "recurring_art_style": string,
    "recurring_composition_patterns": string,
    "dominant_color_tendencies": [{"hex": string, "name": string}],
    "recurring_lighting_mood": string,
    "recurring_background_style": string,
    "typography_tendencies": string,
    "style_tags_ranked": [string],
    "summary_style_dna": string
  },
  "negative_patterns": {
    "recurring_avoid_elements": [string],
    "avoid_style_tags": [string],
    "summary_negative_dna": string
  },
  "confidence": "low" | "medium" | "high",
  "changelog": string,
  "drift_flag": boolean
}

Rules:
- "changelog" is a 1-3 sentence internal note: what changed since the last
  version and why (or "no meaningful change" if NEW_RECORDS didn't shift
  anything).
- "drift_flag" = true only for a genuine, consistent stylistic shift worth
  flagging for a full from-scratch recreate — not for ordinary incremental
  refinement. Default to false when uncertain.
- Output valid JSON only."""

# USER — şablon; gerçek fingerprint + delta her çağrıda .format() ile doldurulur.
MERGE_USER_PROMPT_TEMPLATE = """Here is the brand's current fingerprint and the new evidence gathered since
it was last updated on {last_updated}.

CURRENT_FINGERPRINT:
{current_fingerprint_json}

NEW_RECORDS ({count} new images since the last update):
{new_records_json}

Update the fingerprint incrementally, following the merge instructions you
have been given."""
```

```python
# apps/fingerprint/services/agent4_merge.py
import json
from ..schemas import MergeOutput
from ..prompts import MERGE_SYSTEM_PROMPT, MERGE_USER_PROMPT_TEMPLATE
from .base import call_structured
from ..models import BrandFingerprint, ImageAnalysisRecord


def run_merge(workspace_id: int) -> tuple[MergeOutput, list[int]]:
    fp = BrandFingerprint.objects.get(workspace_id=workspace_id)

    new_records = list(
        ImageAnalysisRecord.objects.filter(
            workspace_id=workspace_id, included_in_fingerprint_version__isnull=True
        ).values("id", "analysis", "rating")
    )
    new_ids = [r["id"] for r in new_records]

    current_fingerprint = {
        "visual_dna": fp.visual_dna,
        "negative_patterns": fp.negative_patterns,
        "confidence": fp.confidence,
        "based_on_image_count": fp.based_on_image_count,
    }
    new_records_payload = [{"analysis": r["analysis"], "rating": r["rating"]} for r in new_records]

    user_text = MERGE_USER_PROMPT_TEMPLATE.format(
        last_updated=fp.updated_at.isoformat(),
        current_fingerprint_json=json.dumps(current_fingerprint, ensure_ascii=False),
        count=len(new_records),
        new_records_json=json.dumps(new_records_payload, ensure_ascii=False),
    )
    messages = [{"role": "user", "content": user_text}]

    result = call_structured(
        system=MERGE_SYSTEM_PROMPT,
        messages=messages,
        output_model=MergeOutput,
        max_tokens=3072,
        agent_name="agent4_merge",
    )
    return result, new_ids
```

**Celery task + tetikleyiciler (24 saat / hacim eşiği / recreate zinciri):**

```python
@shared_task(bind=True, max_retries=2, default_retry_delay=120, queue="fingerprint")
def run_merge_task(self, workspace_id: int):
    from django.core.cache import cache
    from django.db import transaction
    from django.utils import timezone
    from .models import BrandFingerprint, ImageAnalysisRecord
    from .services.agent4_merge import run_merge
    from .services.base import AgentCallFailed

    lock_key = f"fingerprint:merge-lock:{workspace_id}"
    if not cache.add(lock_key, "locked", timeout=60 * 10):
        return  # zaten çalışıyor (24h tetikleyici + hacim tetikleyici çakışması önlenir)

    try:
        fp = BrandFingerprint.objects.filter(workspace_id=workspace_id).first()
        if fp is None:
            return  # henüz hiç fingerprint yok — cold start, Agent 3 generic şablon kullanır

        has_new = ImageAnalysisRecord.objects.filter(
            workspace_id=workspace_id, included_in_fingerprint_version__isnull=True
        ).exists()
        if not has_new:
            return  # yeni veri yok, harmanlamaya gerek yok

        try:
            result, new_ids = run_merge(workspace_id)
        except AgentCallFailed as exc:
            raise self.retry(exc=exc)

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

        if result.drift_flag:
            # Otomatik tam recreate tetikle — merge'in kendi tespit ettiği sapma düzeltmesi
            run_full_recreate_task.delay(workspace_id, reason="drift_flag")
    finally:
        cache.delete(lock_key)
```

**Periyodik tetikleyici (Celery beat, her saat başı çalışıp uygunları işler):**

```python
# apps/fingerprint/tasks.py
from celery.schedules import crontab
from django.utils import timezone
from datetime import timedelta


@shared_task(queue="fingerprint")
def check_scheduled_merges():
    """Celery beat: her saat başı çalışır. 24 saati geçmiş VE yeni verisi
    olan tüm workspace fingerprint'lerini merge kuyruğuna atar."""
    from .models import BrandFingerprint, ImageAnalysisRecord

    cutoff = timezone.now() - timedelta(hours=24)
    candidates = BrandFingerprint.objects.filter(updated_at__lte=cutoff).values_list(
        "workspace_id", flat=True
    )
    for workspace_id in candidates:
        has_new = ImageAnalysisRecord.objects.filter(
            workspace_id=workspace_id, included_in_fingerprint_version__isnull=True
        ).exists()
        if has_new:
            run_merge_task.delay(workspace_id)


# celery.py içinde:
# app.conf.beat_schedule = {
#     "fingerprint-scheduled-merges": {
#         "task": "apps.fingerprint.tasks.check_scheduled_merges",
#         "schedule": crontab(minute=0),  # her saat başı
#     },
# }
```

**Gün içi hacim eşiği (~25) — erken tetik:** her yeni pozitif/negatif/nötr kayıt eklendiğinde Redis'te günlük sayaç artırılır; eşik aşılırsa merge erken tetiklenir.

```python
def _maybe_trigger_early_merge(workspace_id: int):
    from django.core.cache import cache

    today_key = f"fingerprint:daily-count:{workspace_id}:{timezone.now().date()}"
    count = cache.incr(today_key) if cache.get(today_key) is not None else 1
    if count == 1:
        cache.expire(today_key, 60 * 60 * 26)  # ~26 saat sonra sil
    VOLUME_THRESHOLD = 25  # Kararlar.md §10 — sonra workspace bazında ayarlanabilir
    if count == VOLUME_THRESHOLD:
        run_merge_task.delay(workspace_id)
```

Bu fonksiyon `run_agent1_for_record` task'ının sonunda çağrılıyor (bkz. §5).

---

## 9. Agent 3 — Prompt Üretim Ajanı (SENKRON)

```python
# SYSTEM — Fingerprint_Kararlar.md §5'teki tam metin, birebir.
AGENT3_SYSTEM_PROMPT = """You are a prompt-writing specialist for text-to-image generation, working for a
platform that produces advertising creatives for betting/sportsbook and casino
brands.

You will receive:
1. A BRAND_FINGERPRINT JSON describing a specific brand's visual identity:
   - brand_profile (colors, typographic style, logo description, CTA/promo
     tone — always reliable, deterministic).
   - visual_dna (recurring composition/lighting/color patterns inferred from
     past creatives), tagged with a confidence level: "low", "medium", or
     "high".
   - negative_patterns (optional): style elements and tags that have
     historically correlated with low user ratings for this brand — things to
     lean away from, not hard bans.
2. A USER_REQUEST: free-text description of what the user wants generated
   right now.

Confidence handling for visual_dna:
- "high" or "medium": treat visual_dna as an established part of this brand's
  identity, weave it in with normal confidence.
- "low": visual_dna is based on very few past images and may just be noise.
  Use it only as a tentative, soft suggestion — do not present it as a firm
  brand trait, and let the user's request or brand_profile take precedence
  whenever visual_dna would otherwise dominate the scene.

Negative_patterns handling:
- These are soft steers, not hard constraints. If the user's request doesn't
  conflict with them, lightly avoid the flagged elements in the main prompt
  and note the most relevant ones in the negative_prompt.
- Never let an avoid-pattern override or contradict an explicit user request —
  if the user explicitly asks for something that appears in negative_patterns,
  honor the user.

Your job: write ONE final text-to-image prompt (plus an optional short negative
prompt) that will be sent directly to a text-to-image model (e.g. FLUX, SDXL,
or similar) to produce the image.

Priorities, in strict order:
1. The user's explicit request is the primary driver of subject, scene, and
   action. Never override, water down, or ignore what the user asked for.
2. Weave in the brand's visual identity (brand_profile always; visual_dna per
   the confidence handling above) as descriptive flavoring that makes the
   output feel consistent with this brand's past creatives — but only where it
   does not conflict with the user's request.
3. Lightly steer away from negative_patterns per the handling above.
4. Do not invent additional requirements, restrictions, or mandatory elements
   (do not force a logo, disclaimer text, or a specific CTA into the scene)
   unless the user's request or the brand fingerprint explicitly implies it.
   This prompt is for creative generation only — legal/compliance text overlays
   are handled separately by the platform, never inside this prompt.
5. Keep the prompt model-agnostic: plain descriptive natural language. No
   platform-specific syntax (no "--ar", no weighted tokens, no markdown).
6. Be visually concrete: describe subject, action, composition, color,
   lighting, mood, and any on-image text explicitly requested by the user —
   the way a creative director would brief a photographer or illustrator.
7. If the user's request conflicts with the brand's typical style (e.g. asks
   for something entirely different), honor the user's request fully and only
   lightly nod to brand colors/mood if it fits naturally — never force it.

Output strictly as JSON, nothing else:
{
  "prompt": string,
  "negative_prompt": string,
  "notes": string
}

"notes" is for internal logging only: 1-2 sentences on which brand elements
(including the confidence level applied and any negative_patterns used) were
used and why (or why none were used, if the user's request didn't leave room)."""

# USER — şablon; her üretim isteğinde fingerprint + kullanıcının isteği
# .format() ile dolduruluyor. Bu, sistemin sabit talimatlarından ayrı, o anki
# görevin somut içeriği.
AGENT3_USER_PROMPT_TEMPLATE = """BRAND_FINGERPRINT:
{fingerprint_json}

USER_REQUEST:
{user_request}

Write the final text-to-image prompt now, following the priorities and the
confidence/negative_patterns handling you have been given."""
```

```python
# apps/fingerprint/services/agent3_prompt_generation.py
import json
from ..schemas import PromptGenerationOutput
from ..prompts import AGENT3_SYSTEM_PROMPT, AGENT3_USER_PROMPT_TEMPLATE
from .base import call_structured
from ..models import BrandFingerprint

GENERIC_COLD_START_TEMPLATE = {
    "brand_profile": {
        "color_palette": {"primary": [{"hex": "#0B5D3B", "name": "casino green", "role": "primary"}]},
        "brand_tone_keywords": ["energetic", "trustworthy", "bold"],
    },
    "confidence": "low",
    "negative_patterns": {},
}


def generate_prompt(workspace_id: int, user_request: str) -> PromptGenerationOutput:
    fp = BrandFingerprint.objects.filter(workspace_id=workspace_id).first()

    if fp is None:
        # Cold start — Kararlar.md §5: generic betting/casino şablonu
        fingerprint_payload = GENERIC_COLD_START_TEMPLATE
    else:
        fingerprint_payload = {
            "brand_profile": fp.brand_profile,
            "visual_dna": fp.visual_dna,
            "confidence": fp.confidence,
            "negative_patterns": fp.negative_patterns,
        }

    user_text = AGENT3_USER_PROMPT_TEMPLATE.format(
        fingerprint_json=json.dumps(fingerprint_payload, ensure_ascii=False),
        user_request=user_request,
    )
    messages = [{"role": "user", "content": user_text}]

    return call_structured(
        system=AGENT3_SYSTEM_PROMPT,
        messages=messages,
        output_model=PromptGenerationOutput,
        max_tokens=1024,
        effort="low",  # senkron/kullanıcı bekliyor — latency öncelikli
        agent_name="agent3_prompt_generation",
        max_attempts=2,
    )
```

**Django view — üretim isteğinin senkron akışının içinde çağrılır:**

```python
# apps/fingerprint/api/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from ..services.agent3_prompt_generation import generate_prompt
from ..services.base import AgentCallFailed


class GeneratePromptView(APIView):
    def post(self, request, workspace_id):
        user_request = request.data["user_request"]
        try:
            result = generate_prompt(workspace_id, user_request)
        except AgentCallFailed:
            # Agent 3 çöktüyse fallback: kullanıcının ham isteğini doğrudan gönder
            # (brand tadı olmadan) — üretim akışı hiç durmasın.
            return Response({
                "prompt": user_request,
                "negative_prompt": "",
                "notes": "fingerprint agent unavailable, raw request used",
            })

        # fal.ai çağrısı burada result.prompt / result.negative_prompt ile devam eder
        return Response(result.model_dump(mode="json"))
```

**Not — prompt caching kullanılmıyor (Kararlar.md §9):** Agent 3 her workspace için sık çağrılacak olsa da, karar gereği ilk versiyonda `cache_control` eklenmiyor. İleride eklenecekse, `fingerprint_payload` kısmı `system` promptunun sonuna sabit blok olarak taşınıp `cache_control: {"type": "ephemeral"}` ile işaretlenebilir — şu anki kodda bu hazır değil, bilinçli bir sadeleştirme.

---

## 10. Manuel "recreate" endpoint'i

```python
# apps/fingerprint/api/views.py (devamı)
class RecreateFingerprintView(APIView):
    def post(self, request, workspace_id):
        from ..tasks import run_full_recreate_task
        run_full_recreate_task.delay(workspace_id, reason="manual")
        return Response({"status": "queued"}, status=202)
```

Frontend, workspace ayarlarında bu endpoint'i çağıran "Recreate" butonunu gösterir; `BrandFingerprint.updated_at` ve `last_full_recreate_at` alanları da aynı ekranda "son güncelleme" bilgisini vermek için kullanılır.

---

## 11. Sinyal/tetikleyici özet tablosu (kod karşılığı)

| Olay | Django tarafı | Celery task |
|---|---|---|
| Galeriye görsel yüklendi | `MediaAsset` post_save → `ImageAnalysisRecord.objects.create(source="gallery", ...)` | `run_agent1_for_record.delay(record.id)` |
| Üretim puanlandı (rating alanı set edildi) | `Generation` post_save (rating değişti mi kontrolü) | ≥7: `ImageAnalysisRecord(source="generation", rating=...)` oluştur → `run_agent1_for_record.delay(...)`. ≤4 ve 5-6 için de aynı, `sentiment` `save()` içinde otomatik hesaplanıyor (bkz. §3) |
| Brand kit güncellendi | `BrandKit` post_save | `run_agent2_for_brand_kit.delay(brand_kit.id)` |
| 24 saat + yeni veri | Celery beat (`check_scheduled_merges`, saatlik) | `run_merge_task.delay(workspace_id)` |
| Günlük hacim eşiği (~25) aşıldı | `run_agent1_for_record` task'ının sonunda `_maybe_trigger_early_merge` | `run_merge_task.delay(workspace_id)` |
| Agent 4 `drift_flag=True` döndü | `run_merge_task` içinde | `run_full_recreate_task.delay(workspace_id, reason="drift_flag")` |
| Kullanıcı "recreate" bastı | `RecreateFingerprintView` | `run_full_recreate_task.delay(workspace_id, reason="manual")` |
| Kullanıcı "üret" dedi | `GeneratePromptView` (senkron) | Yok — doğrudan `generate_prompt()` çağrılır |

---

## 12. Django settings / bağımlılıklar

```python
# requirements.txt'e eklenecek
anthropic>=0.110.0
celery>=5.4
redis>=5.0          # Celery broker + cache.add lock mekanizması için
pydantic>=2.7
```

```python
# settings.py
ANTHROPIC_API_KEY = env("ANTHROPIC_API_KEY")

CELERY_TASK_ROUTES = {
    "apps.fingerprint.tasks.*": {"queue": "fingerprint"},
}
CELERY_TASK_ACKS_LATE = True          # worker çökerse task kaybolmasın
CELERY_TASK_REJECT_ON_WORKER_LOST = True

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": env("REDIS_URL"),
    }
}
```

`fingerprint` kuyruğunu ayrı tutmak önemli: Agent 1/2/4/Sentez çağrıları Anthropic API'ye vision + uzun context gönderiyor (yavaş), bunları uygulamanın diğer Celery kuyruklarından (ör. email gönderimi) izole etmek, birinin diğerini bloklamasını engeller.

---

## 13. Test stratejisi (özet)

- **Birim testleri:** `call_structured` mock'lanarak (Anthropic client'ı `unittest.mock` ile sahteleyip) her agent servis fonksiyonu için — gerçek API çağrısı yapılmadan Pydantic model çıktısının doğru DB alanlarına yazıldığı test edilir.
- **Entegrasyon testi (gerçek API, CI'da opsiyonel/manuel):** Küçük bir test görseliyle Agent 1'in gerçekten geçerli `ImageAnalysisOutput` döndürdüğünü doğrulayan bir smoke test — `ANTHROPIC_API_KEY` gerektirir, CI'da varsayılan olarak skip edilir.
- **Celery task testleri:** `CELERY_TASK_ALWAYS_EAGER=True` ile task'ların senkron çalıştığı test ortamında lock mekanizmasının (aynı workspace için iki kez `run_merge_task` çağrılırsa ikincisinin no-op olması) doğrulanması.

---

## 14. Kapsam dışı / sonraki adım notları

- Faz 2 (embedding/pgvector) bu plana dahil değil — `ImageAnalysisRecord`'a ileride bir `embedding = VectorField()` (pgvector Django extension) eklenmesi kolay, ama bu implementasyonda yok.
- Fingerprint'in kullanıcıya gösterilmesi (frontend UI) bu planın kapsamında değil — sadece backend/API tarafı.
- `compliance_requirements` alanı şemada duruyor ama bu implementasyonda hiçbir agent onu üretmiyor/okumuyor — mevcut ayrı sistemden (workspace ayarları) geldiği varsayılıyor, Agent 3'e hiç geçirilmiyor.
