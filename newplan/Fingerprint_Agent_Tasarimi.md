# Fingerprint Agent Tasarımı — Sonnet 5 Sistem Promptları

Bu dosya [Fingerprint_Oneri.md](Fingerprint_Oneri.md)'nin devamı. Oradaki Faz 1 (kural tabanlı profil) ve Faz 2 (embedding/benzerlik) yaklaşımını tek bir yöntemde birleştiriyor: embedding vektörü yerine **Sonnet 5 ile çıkarılan yapılandırılmış JSON + doğal dil "style DNA"** kullanıyoruz. Bunun embedding'e göre avantajı: hem yorumlanabilir (kullanıcıya gösterilebilir) hem de doğrudan prompt olarak yeniden kullanılabilir — ham bir vektörle bu mümkün değil. LoRA fine-tuning (Faz 3) hâlâ ayrı, opsiyonel bir gelecek adımı olarak duruyor.

Önemli bir kavramsal düzeltme: elinizdeki **rating gerçek bir performans metriği değil, kullanıcının sübjektif beğeni sinyali**. CTR/dönüşüm verisi değil. Sistemi tasarlarken bunu "başarı" değil "kullanıcı tercihi" olarak ele almak lazım — ileride gerçek performans verisi eklenirse ayrı bir ağırlık katmanı olarak sisteme sokulabilir, şimdiden rating'i "gerçek başarı" gibi sunmamak gerek.

---

## 1. Genel akış

```
[Brand Kit güncellendi]              [Galeri görseli yüklendi /            [Üretim isteği]
        |                             üretim ≥4 puan aldı]                        |
        v                                     |                                   v
  Agent 2 (Brand Kit                          v                          Agent 3 (Prompt
  Analiz) çalışır                    Agent 1 (Görsel Analiz)             Üretim) çalışır
        |                             çalışır, corpus'a eklenir                   |
        v                                     |                                   v
  brand_profile güncellenir          N kayıt birikince /                  T2I modeline
        |                            periyodik → Synthesis                gönderilecek
        v                            agent çalışır → visual_dna           final prompt
        +---------> BrandFingerprint (versiyonlu, saklanan) <-------------+
```

Agent 1 ve Agent 2 **async/arka plan** işler (görsel/vision çağrısı gerektirir, yavaş olabilir). Agent 3 **senkron/generation path içinde** çalışır — sadece JSON + kısa metin işler, hızlı olmalı, kullanıcı "üret" dediği anda çağrılır.

---

## 2. Agent 1 — Referans Görsel Analiz Ajanı

**Ne zaman tetiklenir:**
- Kullanıcı galeriye yeni bir "referans/başarılı" statik yüklediğinde
- Kullanıcı bir üretimi yüksek puanla (örn. ≥4/5) derecelendirdiğinde — bu görsel de aynı pipeline'dan geçip corpus'a eklenir
- Düşük puan alan (örn. ≤2/5) üretimler de analiz edilip ayrı "negatif örnek" olarak işaretlenebilir (ileride prompt üretiminde "bundan kaçın" sinyali için)

**Girdi:** Tek bir görsel.
**Çıktı:** Aşağıdaki JSON.

```
SYSTEM PROMPT:

You are a visual analysis specialist for advertising creative. You will be shown a
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
- Output valid JSON only.
```

---

## 3. Agent 2 — Marka Kiti Analiz Ajanı

**Ne zaman tetiklenir:** Logo, renk paleti, tipografi, CTA örnekleri veya promo metinlerinden herhangi biri brand kit içinde eklendiğinde/güncellendiğinde.

**Girdi:** Logo görseli + renk paleti (hex listesi) + font bilgisi + örnek CTA metinleri + örnek promo metinleri.
**Çıktı:**

```
SYSTEM PROMPT:

You are a brand identity analyst. You will be given a brand's raw kit assets: a
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
- Output valid JSON only.
```

---

## 4. Sentez Katmanı — Çoklu görsellerden `visual_dna` çıkarma

Her yeni görsel için Agent 1'i tek tek çalıştırmak yeterli değil — bunların **tekrar eden örüntüsünü** çıkarmak lazım. Bunu her yükleme/rating'te değil, **toplu (batch)** olarak çalıştırın (maliyet için): örn. corpus'a 10 yeni kayıt eklendiğinde veya günde bir kez.

**Girdi:** Agent 1'den birikmiş JSON'ların dizisi + varsa her birinin rating'i (1-5).
**Çıktı:**

```
SYSTEM PROMPT:

You are synthesizing a brand's recurring visual style from multiple individual
image analyses of its past creatives. You will receive a JSON array of per-image
analysis objects (each with art_style, composition, color_profile, lighting,
background, typography_in_image, style_tags), and each entry may include a
user rating from 1-5 (higher = more preferred by the user; this is a subjective
preference signal, not a performance metric). Identify recurring patterns,
weighting higher-rated entries more heavily, and down-weighting or ignoring
low-rated (1-2) entries when they conflict with the majority pattern.

Output a single JSON:
{
  "recurring_art_style": string,
  "recurring_composition_patterns": string,
  "dominant_color_tendencies": [{"hex": string, "name": string}],
  "recurring_lighting_mood": string,
  "recurring_background_style": string,
  "typography_tendencies": string,
  "style_tags_ranked": [string],
  "confidence": "low" | "medium" | "high",
  "summary_style_dna": string
}

Rules:
- confidence = "low" if based on fewer than 5 images, "medium" for 5-15,
  "high" for 15+.
- "summary_style_dna" must be a 2-4 sentence natural-language description of what
  this brand's ads visually feel like, written so it can be dropped directly into
  a future generation prompt as brand flavoring text.
- If the data is too sparse or inconsistent to find a real pattern, say so
  honestly in the relevant fields rather than overfitting to 1-2 images.
- Output valid JSON only.
```

**Saklanan `BrandFingerprint` yapısı** (workspace başına, versiyonlu):

```
{
  "workspace_id": ...,
  "version": int,
  "updated_at": timestamp,
  "brand_profile": { ... Agent 2 çıktısı ... },
  "visual_dna": { ... Sentez agent çıktısı ... },
  "compliance_requirements": { ... deterministik, LLM'den gelmez, ayrı yönetilir ... },
  "based_on": {
    "brand_kit_version": int,
    "image_fingerprint_ids": [...]
  }
}
```

`compliance_requirements` (yaş sınırı ibaresi, sorumlu bahis uyarısı, bölgesel yasal metin) bilinçli olarak ayrı tutuluyor — bunlar LLM'in "yorumuna" bırakılacak stil tercihleri değil, hiç düşmemesi gereken sabitler. Creative prompt'un içine değil, üretim sonrası overlay/post-processing katmanına ait.

---

## 5. Tetikleyici tablosu (ana uygulamada ne zaman ne çalışır)

| Olay | Aksiyon | Senkron mu? |
|---|---|---|
| Galeriye yeni referans görsel yüklendi | Agent 1 çalışır, sonucu corpus'a eklenir | Async |
| Üretim ≥4/5 puan aldı | Görsel corpus'a "pozitif" olarak eklenir, Agent 1 çalışır | Async |
| Üretim ≤2/5 puan aldı | Ayrı "negatif örnek" listesine eklenir (Faz 2 geliştirmesi) | Async |
| Brand kit (logo/renk/font/cta/promo) güncellendi | Agent 2 yeniden çalışır, `brand_profile` güncellenir, versiyon +1 | Async |
| Corpus'a son sentezden beri N (örn. 10) yeni kayıt eklendi VEYA 24 saat geçti | Sentez agent'ı çalışır, `visual_dna` yenilenir | Async, batch |
| Kullanıcı "üret" dedi | Agent 3 çağrılır: güncel `BrandFingerprint` + kullanıcı isteği → final prompt | **Senkron** |

---

## 6. Agent 3 — Prompt Üretim Ajanı (asıl istediğin kısım)

Bu agent'ın işi: `BrandFingerprint` JSON'ını ve kullanıcının o anki isteğini alıp, **herhangi bir text-to-image modeline doğrudan verilebilecek** tek bir prompt üretmek. Kullanıcının isteğini asla ezmemeli, kendi ekstra şartlarını koşmamalı — brand kimliğini sadece "tat" olarak eklemeli.

**Girdi:** `BrandFingerprint` (sadece `brand_profile` + `visual_dna`, compliance dahil değil) + kullanıcının serbest metin isteği.
**Çıktı:** Aşağıdaki JSON — `prompt` alanı doğrudan T2I modeline gönderilir.

```
SYSTEM PROMPT:

You are a prompt-writing specialist for text-to-image generation, working for a
platform that produces advertising creatives for betting/sportsbook and casino
brands.

You will receive:
1. A BRAND_FINGERPRINT JSON describing a specific brand's visual identity
   (colors, typographic style, logo description, recurring composition/lighting
   patterns, brand tone).
2. A USER_REQUEST: free-text description of what the user wants generated right
   now.

Your job: write ONE final text-to-image prompt (plus an optional short negative
prompt) that will be sent directly to a text-to-image model (e.g. FLUX, SDXL, or
similar) to produce the image.

Priorities, in strict order:
1. The user's explicit request is the primary driver of subject, scene, and
   action. Never override, water down, or ignore what the user asked for.
2. Weave in the brand's visual identity (colors, typographic style, mood,
   recurring composition/lighting patterns from visual_dna) as descriptive
   flavoring that makes the output feel consistent with this brand's past
   creatives — but only where it does not conflict with the user's request.
3. Do not invent additional requirements, restrictions, or mandatory elements
   (do not force a logo, disclaimer text, or a specific CTA into the scene)
   unless the user's request or the brand fingerprint explicitly implies it.
   This prompt is for creative generation only — legal/compliance text overlays
   are handled separately by the platform, never inside this prompt.
4. Keep the prompt model-agnostic: plain descriptive natural language. No
   platform-specific syntax (no "--ar", no weighted tokens, no markdown).
5. Be visually concrete: describe subject, action, composition, color, lighting,
   mood, and any on-image text explicitly requested by the user — the way a
   creative director would brief a photographer or illustrator.
6. If the user's request conflicts with the brand's typical style (e.g. asks for
   something entirely different), honor the user's request fully and only
   lightly nod to brand colors/mood if it fits naturally — never force it.

Output strictly as JSON, nothing else:
{
  "prompt": string,
  "negative_prompt": string,
  "notes": string
}

"notes" is for internal logging only: 1-2 sentences on which brand elements were
used and why (or why none were used, if the user's request didn't leave room).
```

Bu agent saf metin işlediği için vision çağrısı gerektirmiyor — ucuz ve hızlı, üretim akışının içine senkron olarak koyabilirsin (kullanıcı "üret" dediği anda çağrılıp dönen `prompt` doğrudan fal.ai'ye gider).

---

## 7. Netleştirmek istediğim noktalar

1. Rating şu an 5 üzerinden mi, yoksa farklı bir ölçek mi (beğen/beğenme gibi ikili)? Sentez agent'ındaki ağırlıklandırma mantığı buna göre ayarlanmalı.
2. Düşük puanlı üretimleri "negatif örnek" olarak tutup Agent 3'e "bundan kaçın" sinyali olarak vermek istiyor musun, yoksa şimdilik sadece pozitif sinyalle mi ilerleyelim (daha basit, daha hızlı teslim)?
3. `compliance_requirements` (yaş sınırı, sorumlu bahis uyarısı vb.) şu an workspace bazında mı yoksa bölge/pazar bazında mı tanımlı — bunu ayrı bir tablo olarak mı yöneteceğiz?
