# Fingerprint Sistemi — Alınan Kararlar ve Güncellenmiş Tasarım

Bu dosya [Fingerprint_Oneri.md](Fingerprint_Oneri.md) ve [Fingerprint_Agent_Tasarimi.md](Fingerprint_Agent_Tasarimi.md)'nin devamı. Orijinal tasarımın açık bıraktığı kararlar netleştirildi; bu netleşme sonucunda tasarımda değişen kısımlar (özellikle **aktif negatif sinyal** ve **yeni bir Agent 4 — Harmanlama Ajanı**) burada güncellendi.

---

## 1. Alınan kararlar

### Ürün/iş kararları

| # | Konu | Karar |
|---|---|---|
| 1 | Negatif sinyal | **Aktif** — düşük puanlı üretimler ayrı bir "negatif corpus"a girer, sentez/harmanlama çıktısında `negative_patterns` olarak tutulur ve Agent 3'e "kaçın" sinyali olarak iletilir (hard ban değil, soft steer). |
| 2 | Rating ölçeği | Sistemde **10 üzerinden** puanlama var (UI'da 5 yıldız gösteriliyor, yarım yıldız = 1 puan). Mevcut sistem doğrudan entegre edilecek. |
| 3 | Rating zorunlu mu | **Opsiyonel** — puanlamayan üretimler corpus'a girmez, sinyal sadece gönüllü puanlardan gelir. |
| 4 | Compliance requirements | Zaten workspace bazında mevcut bir sistem var; LLM tarafından "öğrenilecek" bir şey değil — kullanıcı hangi compliance öğesinin kullanılacağını manuel seçiyor. Tasarımdaki ayrım (deterministik, LLM dışı, ayrı yönetilir) **değişmeden korunuyor**. |
| 5 | Cold start | Fingerprint hiç oluşmamışken (yeni workspace) Agent 3, **generic bir betting/casino şablonu** kullanır. |
| 6 | Şeffaflık/UI | Fingerprint'in kullanıcıya gösterilmesi/düzenlenmesi **bu fazda dahil değil** — önce backend/pipeline kurulacak. |
| 7 | Versiyon güncelleme mekanizması | Aşağıda ayrıntılı (bkz. §2). |
| 8 | Versiyonlama şeması | `brand_profile_version` ve `visual_dna_version` **ayrı ayrı** artar. |

### Veri/mimari kararları

| # | Konu | Karar |
|---|---|---|
| 9 | Confidence propagation | Agent 3'ün promptuna `confidence` alanı eklenir; "low" ise visual_dna'yı kesin marka özelliği gibi dayatmaması, hafif/tentative bir ipucu olarak kullanması söylenir (LLM'e talimat olarak, kod seviyesinde hard-cut değil). |
| 10 | Gün içi hacim eşiği | Varsayılan **~25 üretim/gün** (20-30 aralığında, sonradan ince ayar yapılabilir; ihtiyaç olursa workspace bazında override edilebilir). |
| 11 | JSON hata yönetimi | Herhangi bir agent'tan (1/2/3/4) geçersiz JSON gelirse: retry, N deneme sonrası hâlâ hata varsa **mevcut fingerprint korunur**, hata loglanır, bir sonraki tetikte tekrar denenir. |
| 12 | Puan eşikleri | **≥7 pozitif, ≤4 negatif, 5-6 nötr** (10 üzerinden). Corpus'a hangi kovaya gireceğini bu eşikler belirler — ama LLM'e (sentez/harmanlama agent) sadece "pozitif/negatif" etiketi değil, **ham puan** (7, 8, 9, 10 / 1, 2, 3, 4) gönderilir; ağırlıklandırma bu ham skora göre nüanslı yapılır. |
| 13 | Prompt caching | **Şimdilik yok** — ilk versiyon basit tutulacak, ihtiyaç görülürse sonra eklenir. |
| 14 | Faz kapsamı | **Sadece Faz 1** (Agent 1/2/3/4 + sentez, tamamen JSON/metin tabanlı). Embedding/vektör DB/referans görsel (Faz 2) ve LoRA (Faz 3) bu implementasyonun dışında. |

---

## 2. Versiyon güncelleme mekanizması (yeni, detaylı)

Kullanıcı workspace ayarlarında fingerprint'in **son güncelleme tarihini** görecek + manuel bir **"recreate"** butonu olacak.

- **Manuel recreate**: Fingerprint sıfırdan üretilir — tüm ham corpus (pozitif + negatif + nötr, tüm geçmiş) Sentez agent'ından geçer. `last_full_recreate_at` güncellenir.
- **Otomatik (varsayılan, 24 saatte bir)**: Sıfırdan değil, **mevcut fingerprint + son güncellemeden beri birikmiş yeni veri** harmanlanır. Bunun için yeni bir agent gerekiyor: **Agent 4 — Harmanlama (Merge) Ajanı** (bkz. §4).
- **Erken tetik**: Gün içinde üretim hacmi eşiği (~25) aşılırsa, 24 saat dolmadan da Agent 4 tetiklenir.
- **Drift önlemi**: Agent 4'ün çıktısına bir `drift_flag` eklendi. Agent 4, yeni veri mevcut örüntüyle **tutarlı bir şekilde çelişiyorsa** (gürültü değil, gerçek bir stil kayması) bu flag'i `true` döner; bu durumda sistem otomatik olarak tam bir **recreate** (Sentez agent, tüm ham corpus ile) tetikler. Böylece özet-üstüne-özet harmanlamanın zamanla biriktirebileceği sapma (drift) riski, agent'ın kendi tespitiyle düzeltiliyor — sabit bir periyotla zorunlu tam yeniden hesaplama yapılmıyor.

---

## 3. Güncellenmiş Sentez Agent (tam yeniden hesaplama / "recreate")

Önceki tasarımdaki Sentez Katmanı'nın yerini alıyor — artık hem `visual_dna` hem `negative_patterns` tek seferde üretiliyor (aktif negatif sinyal kararına göre), ham puan (1-10) kullanılıyor.

**Ne zaman çalışır:** Kullanıcı "recreate" bastığında (manuel) VEYA Agent 4'ün `drift_flag=true` döndüğü durumda (otomatik).

**Girdi:** Tüm ham corpus — Agent 1'den gelen per-image analiz JSON'larının tam dizisi, her biri varsa ham puanıyla (1-10) birlikte. Puansız girişler (galeriye direkt yüklenen referans görseller) güçlü pozitif kabul edilir.

```
SYSTEM PROMPT:

You are synthesizing a brand's recurring visual style — and its recurring
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
- Output valid JSON only.
```

---

## 4. Yeni — Agent 4: Fingerprint Harmanlama (Merge) Ajanı

**Ne zaman tetiklenir:**
- Otomatik, varsayılan her 24 saatte bir (son güncellemeden beri yeni kayıt varsa)
- Gün içi üretim hacmi eşiği (~25) aşıldığında, 24 saat dolmadan erken

**Girdi:**
1. `CURRENT_FINGERPRINT`: mevcut `visual_dna` + `negative_patterns` + `confidence` + toplam kaç görsele dayandığı + son güncelleme zamanı.
2. `NEW_RECORDS`: son güncellemeden bu yana eklenen yeni Agent 1 analiz kayıtları, her biri ham puanıyla (1-10) birlikte.

```
SYSTEM PROMPT:

You are updating an existing brand visual fingerprint with new evidence — you
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
- Output valid JSON only.
```

`drift_flag = true` dönerse: sistem bu harmanlanmış çıktıyı geçici olarak kaydedip arka planda tam bir **Sentez agent (recreate)** çalıştırır, sonucu onunla değiştirir.

---

## 5. Güncellenmiş Agent 3 — Prompt Üretim Ajanı

Değişiklik: `confidence` ve `negative_patterns` artık girdiye dahil.

**Girdi:** `BrandFingerprint` (`brand_profile` + `visual_dna` + `confidence` + `negative_patterns` — compliance dahil değil) + kullanıcının serbest metin isteği.

```
SYSTEM PROMPT:

You are a prompt-writing specialist for text-to-image generation, working for a
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
used and why (or why none were used, if the user's request didn't leave room).
```

Agent 2 (Brand Kit Analiz Ajanı) değişmedi — [Fingerprint_Agent_Tasarimi.md](Fingerprint_Agent_Tasarimi.md#3-agent-2--marka-kiti-analiz-ajanı) içindeki hâliyle geçerli.

---

## 6. Güncellenmiş `BrandFingerprint` yapısı

```
{
  "workspace_id": ...,
  "brand_profile_version": int,
  "visual_dna_version": int,
  "updated_at": timestamp,
  "last_full_recreate_at": timestamp,
  "brand_profile": { ... Agent 2 çıktısı ... },
  "visual_dna": { ... Sentez/Agent 4 çıktısı ... },
  "negative_patterns": { ... Sentez/Agent 4 çıktısı ... },
  "confidence": "low" | "medium" | "high",
  "based_on_image_count": int,
  "compliance_requirements": { ... deterministik, workspace bazında, kullanıcı seçimi, LLM'den gelmez ... },
  "based_on": {
    "brand_kit_version": int,
    "image_fingerprint_ids": [...],          // tam ham corpus — recreate için
    "new_since_last_update_ids": [...]       // delta işaretçisi, her harmanlamadan sonra temizlenir
  }
}
```

---

## 7. Güncellenmiş tetikleyici tablosu

| Olay | Aksiyon | Senkron mu? |
|---|---|---|
| Galeriye yeni referans görsel yüklendi | Agent 1 çalışır, corpus'a güçlü pozitif olarak eklenir | Async |
| Üretim ≥7/10 puan aldı | Agent 1 çalışır, corpus'a pozitif olarak eklenir (ham puanla) | Async |
| Üretim ≤4/10 puan aldı | Agent 1 çalışır, corpus'a **negatif** olarak eklenir (ham puanla, `negative_patterns`'a girdi) | Async |
| Üretim 5-6/10 puan aldı | Corpus'a nötr olarak eklenir, ana örüntüleri zayıf etkiler | Async |
| Brand kit güncellendi | Agent 2 çalışır, `brand_profile_version` +1 | Async |
| Son güncellemeden beri 24 saat geçti ve yeni kayıt var | **Agent 4** çalışır (harmanlama), `visual_dna_version` +1 | Async, batch |
| Gün içi üretim hacmi ~25'i aştı | Agent 4 erken tetiklenir | Async, batch |
| Agent 4 `drift_flag=true` döndürdü | Otomatik tam **recreate** (Sentez agent, tüm ham corpus) tetiklenir | Async, batch |
| Kullanıcı "recreate" butonuna bastı | Sentez agent, tüm ham corpus ile sıfırdan çalışır, `last_full_recreate_at` güncellenir | Async (kullanıcı tetikli) |
| Herhangi bir agent'tan geçersiz JSON döndü | Retry (N deneme); hâlâ hatalıysa mevcut versiyon korunur, hata loglanır | - |
| Kullanıcı "üret" dedi | **Agent 3** çağrılır: güncel `BrandFingerprint` (confidence + negative_patterns dahil) + kullanıcı isteği → final prompt | **Senkron** |

---

## 8. Kapsam dışı bırakılanlar (bu implementasyonda YOK)

- Fingerprint'in kullanıcıya gösterilmesi/düzenlenmesi (UI) — ayrı iş.
- Anthropic prompt caching — ilk versiyonda yok, sonra eklenebilir.
- Faz 2 (embedding/vektör benzerlik, referans görsel gönderimi) ve Faz 3 (LoRA fine-tuning) — tamamen bu implementasyonun dışında, altyapı hazırlığı bile yapılmıyor.

## 9. Hâlâ netleşmesi gereken küçük implementasyon detayları

- Gün içi hacim eşiğinin kesin sayısı (~25 olarak not edildi, ince ayar sonraya bırakıldı).
- Negatif corpus'un veri modeli: ayrı bir tablo mu, yoksa mevcut corpus tablosunda bir `sentiment`/`rating` alanıyla mı ayrıştırılacak — implementasyon sırasında netleşecek.
- Agent 4 tetiklendiğinde eşzamanlı ikinci bir tetikleyicinin (ör. hem 24 saat hem hacim eşiği aynı anda) çakışmaması için bir lock/idempotency mekanizması gerekiyor.
