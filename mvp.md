# Troxa.ai — Full System Documentation

> Yeni bir arayüze taşımak için hazırlanan eksiksiz sistem belgesi.
> Backend: Django REST Framework · Frontend: React 19 + Tailwind CSS 4

---

## İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Backend — Yapı ve Ayarlar](#backend--yapı-ve-ayarlar)
3. [API Endpoint Referansı](#api-endpoint-referansı)
4. [Veritabanı Modelleri](#veritabanı-modelleri)
5. [Servis Katmanı](#servis-katmanı)
6. [Frontend — Tech Stack ve Yapı](#frontend--tech-stack-ve-yapı)
7. [Sayfa Kataloğu](#sayfa-kataloğu)
8. [API İstemci Katmanı (api.js)](#api-istemci-katmanı)
9. [Auth Akışı](#auth-akışı)
10. [Routing Tablosu](#routing-tablosu)
11. [Global State (AuthContext)](#global-state-authcontext)
12. [Dış Servis Entegrasyonları](#dış-servis-entegrasyonları)
13. [Önemli Davranışlar ve İş Mantığı](#önemli-davranışlar-ve-iş-mantığı)

---

## Genel Bakış

Troxa.ai; RMG (gerçek para oyunları) markalarına yönelik bir AI reklam yaratıcısı SaaS uygulamasıdır.

**Ana özellikler:**
- Çok-workspace (multi-tenant) sistem, rol tabanlı erişim
- AI ile görsel üretimi (3 model: Nano Banana 2 / GPT Image 2 / Grok Imagine)
- Logo yerleştirme — otomatik (OpenCV) + Fabric.js canvas editor
- Video üretimi (fotoğraftan, Kling v3 Pro)
- Otomasyon pipeline'ları (zamanlanmış / manuel)
- Marka kiti yönetimi (logolar, referans fotoğraflar, kampanyalar, disclaimer'lar)
- Kredi tabanlı faturalama (her görsel = 1 kredi)
- Takım yönetimi, API anahtarları, davet sistemi
- Aktivite logları ve analitik

**Backend:** Python / Django 4+ / Django REST Framework / SQLite
**Frontend:** React 19 / Vite 6 / Tailwind CSS 4 / React Router 7

---

## Backend — Yapı ve Ayarlar

### Dizin Yapısı

```
backend/
├── config/
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
└── apps/
    ├── accounts/      # Kullanıcı, Workspace, Üyelik, Davet
    ├── creatives/     # Görsel üretimi, Video, Logo editor
    ├── brand_kit/     # Kampanya, Logo, Reference Photo, Disclaimer
    ├── team/          # Takım üyeleri, API Keys, Davetler
    ├── billing/       # Plan, Kredi, İşlem geçmişi
    ├── activity/      # Event log, Analitik
    └── automation/    # Otomasyon pipeline'ları, Zamanlayıcı
```

### Kritik Ayarlar (settings.py)

| Ayar | Değer |
|---|---|
| `AUTH_USER_MODEL` | `accounts.User` |
| `DATABASE` | SQLite3 (`db.sqlite3`) |
| `MEDIA_ROOT` | `BASE_DIR / 'media'` |
| `MEDIA_URL` | `/media/` |
| `SITE_BASE_URL` | env `SITE_BASE_URL` (default: `http://localhost:8000`) |
| `FAL_KEY` | env `FAL_KEY` |
| `JWT ACCESS_TOKEN_LIFETIME` | 60 dakika |
| `JWT REFRESH_TOKEN_LIFETIME` | 7 gün |
| `CORS allowed` | `localhost:3000` + custom header `X-Workspace-ID` |
| `FILE_UPLOAD_MAX_MEMORY_SIZE` | 20 MB |

### Workspace Context

Tüm view'lar `X-Workspace-ID` HTTP header'ı ile çalışır.
`get_workspace(request)` — önce `X-Workspace-ID` header'ına, sonra `?workspace_id` query param'a, sonra kullanıcının ilk workspace'ine bakar.

### URL Routing

```
/admin/                    Django admin
/api/auth/                 JWT kimlik doğrulama
/api/users/                Kullanıcı bilgileri
/api/workspaces/           Workspace CRUD
/api/creatives/            Görsel üretimi, video, logo
/api/brand-kit/            Marka kiti varlıkları
/api/team/                 Takım yönetimi
/api/billing/              Plan ve kredi
/api/activity/             Aktivite logları
/api/automation/           Otomasyon pipeline'ları
/media/                    Yüklenen dosyalar (serve edilir)
```

---

## API Endpoint Referansı

### Auth

| Method | Path | Auth | Açıklama | İstek Gövdesi | Yanıt |
|---|---|---|---|---|---|
| POST | `/api/auth/token/` | Yok | Login | `{email, password}` | `{access, refresh}` |
| POST | `/api/auth/token/refresh/` | Yok | Token yenile | `{refresh}` | `{access}` |
| POST | `/api/auth/register/` | Yok | Kayıt | `{email, password, first_name?, last_name?}` | User objesi |

### Kullanıcılar

| Method | Path | Açıklama | Yanıt |
|---|---|---|---|
| GET | `/api/users/me/` | Mevcut kullanıcı + workspace listesi | `{id, email, username, first_name, last_name, tier, workspaces:[]}` |

### Workspace'ler

| Method | Path | Açıklama | İstek | Yanıt |
|---|---|---|---|---|
| GET | `/api/workspaces/` | Workspace listesi | — | `[{id, name, tier, role, member_count, created_at}]` |
| POST | `/api/workspaces/create/` | Yeni workspace | `{name}` | Workspace obj |
| GET | `/api/workspaces/<uuid>/` | Workspace detayı | — | Workspace obj |
| GET | `/api/workspaces/<uuid>/members/` | Üye listesi | — | `[{id, member_id, name, email, role, joined_at}]` |
| PATCH | `/api/workspaces/<uuid>/members/<id>/` | Rol güncelle | `{role}` | Member obj |
| DELETE | `/api/workspaces/<uuid>/members/<id>/remove/` | Üyeyi çıkar | — | 204 |
| GET | `/api/workspaces/<uuid>/invites/` | Davet listesi | — | `[{id, email, role, status, invited_by_email, created_at}]` |
| POST | `/api/workspaces/<uuid>/invites/` | Davet gönder | `{email, role}` | Invite obj |
| DELETE | `/api/workspaces/<uuid>/invites/<id>/cancel/` | Daveti iptal et | — | 204 |
| POST | `/api/workspaces/invites/<uuid:token>/accept/` | Daveti kabul et | — | `{detail}` |

### Creatives — Görsel Üretimi

| Method | Path | Açıklama | İstek | Yanıt |
|---|---|---|---|---|
| POST | `/api/creatives/generate/` | Üretim işi başlat | Bkz. aşağı | GenerationJob (202) |
| GET | `/api/creatives/jobs/` | Son 20 iş | — | `[GenerationJob]` |
| GET | `/api/creatives/jobs/<id>/` | İş durumu (polling) | — | GenerationJob |
| GET | `/api/creatives/gallery/` | Galeri | `?campaign_id=&media_type=` | `[GeneratedCreative]` |
| PATCH | `/api/creatives/<id>/` | Creative güncelle | `{logo_position?, media_type?, name?, status?}` | GeneratedCreative |
| DELETE | `/api/creatives/<id>/` | Creative sil | — | 204 |
| PATCH | `/api/creatives/<id>/logo/` | Logo pozisyonu güncelle | `{logo_position}` | GeneratedCreative |
| POST | `/api/creatives/<id>/make-video/` | Video üret | `{prompt?}` | VideoJob (202) |
| GET | `/api/creatives/video-jobs/` | Video işleri listesi | — | `[VideoJob]` |
| GET | `/api/creatives/video-jobs/<id>/` | Video iş durumu (polling) | — | VideoJob |
| GET | `/api/creatives/jobs/<job_pk>/logo-placements/` | Logo pozisyonları hesapla | `?logo_id=X` | `{logo, placements:[]}` |
| POST | `/api/creatives/jobs/<job_pk>/logo-editor/save/` | Logo editor kaydet | `{placements:[{creative_id, logos:[{logo_id,x,y,logo_w,logo_h,angle_deg,opacity}]}]}` | `{logo_job_id, images:[]}` |
| GET | `/api/creatives/logo-results/` | Logo sonuçları listesi | — | `[{id, url, source_creative_id, source_creative_name, created_at}]` |

**`/generate/` istek gövdesi:**
```json
{
  "static_ids": [1, 2],
  "campaign_id": 1,
  "disclaimer_id": 1,
  "model_name": "Nano Banana 2",
  "aspect_ratio": "1:1",
  "resolution": "1K",
  "num_images": 2,
  "output_format": "png",
  "extra_prompt": "",
  "generate_new_character": false,
  "image_size": "",
  "image_quality": "high",
  "style": "realistic"
}
```

**GenerationJob yanıt şeması:**
```json
{
  "id": 1,
  "status": "pending|processing|done|error",
  "current_step": "captioning|generating_prompt|generating_images|saving|done|error",
  "model_name": "Nano Banana 2",
  "aspect_ratio": "1:1",
  "resolution": "1K",
  "num_images": 2,
  "output_format": "png",
  "style": "realistic",
  "extra_prompt": "",
  "master_prompt": "...",
  "vibe_and_atmosphere": "...",
  "recommended_colors": [],
  "character_archetype": null,
  "error_message": "",
  "created_at": "2024-01-01T00:00:00Z",
  "creatives": [GeneratedCreative]
}
```

**GeneratedCreative yanıt şeması:**
```json
{
  "id": 1,
  "job_id": 1,
  "name": "Campaign — Variant 1",
  "image_url": "https://fal.ai/...",
  "thumbnail": "https://fal.ai/...",
  "logo_applied_url": "http://localhost:8000/media/logo_results/auto_logo_1_2.png",
  "campaign_name": "Campaign Name",
  "media_type": "Photo|Video",
  "logo_position": "No Logo|Top-Left|Top-Right|Center|Bottom-Left|Bottom-Right",
  "status": "Ready",
  "compliance": "Verified",
  "created_at": "2024-01-01T00:00:00Z",
  "vjob_id": null,
  "vjob_status": null,
  "video_url": null
}
```

### Brand Kit

| Method | Path | Açıklama | İstek | Yanıt |
|---|---|---|---|---|
| GET | `/api/brand-kit/campaigns/` | Kampanya listesi | — | `[{id, name, created_at}]` |
| POST | `/api/brand-kit/campaigns/` | Kampanya oluştur | `{name}` | Campaign obj |
| PATCH | `/api/brand-kit/campaigns/<id>/` | Kampanya güncelle | `{name}` | Campaign obj |
| DELETE | `/api/brand-kit/campaigns/<id>/` | Kampanya sil | — | 204 |
| GET | `/api/brand-kit/logos/` | Logo listesi | — | `[{id, name, file_url, is_primary, uploaded_at}]` |
| POST | `/api/brand-kit/logos/` | Logo yükle | `multipart: {file, name?}` | Logo obj |
| DELETE | `/api/brand-kit/logos/<id>/` | Logo sil | — | 204 |
| GET | `/api/brand-kit/statics/` | Reference photo listesi | — | `[{id, name, url, caption, caption_status, performance, category, uploaded_at}]` |
| POST | `/api/brand-kit/statics/` | Reference photo yükle | `multipart: {file, name?}` | WinningStatic obj |
| DELETE | `/api/brand-kit/statics/<id>/` | Reference photo sil | — | 204 |
| GET | `/api/brand-kit/disclaimers/` | Disclaimer listesi | — | `[{id, text, name, category, is_default, created_at}]` |
| POST | `/api/brand-kit/disclaimers/` | Disclaimer oluştur | `{text, name?, category?, is_default?}` | Disclaimer obj |
| PATCH | `/api/brand-kit/disclaimers/<id>/` | Disclaimer güncelle | `{text?, name?, category?, is_default?}` | Disclaimer obj |
| DELETE | `/api/brand-kit/disclaimers/<id>/` | Disclaimer sil | — | 204 |

### Team

| Method | Path | Açıklama | İstek | Yanıt |
|---|---|---|---|---|
| GET | `/api/team/members/` | Üye listesi | — | `[{id, member_id, name, email, role, joined_at}]` |
| PATCH | `/api/team/members/<id>/` | Rol güncelle | `{role}` | Member obj |
| DELETE | `/api/team/members/<id>/remove/` | Üyeyi çıkar | — | 204 |
| GET | `/api/team/api-keys/` | API key listesi | — | `[{id, name, key_display, is_active, last_used_at, created_at}]` |
| POST | `/api/team/api-keys/` | API key oluştur | `{name}` | `{...key_display, key (tek seferlik gösterim)}` |
| DELETE | `/api/team/api-keys/<id>/` | API key sil | — | 204 |
| GET | `/api/team/invites/` | Davet listesi | — | `[{id, email, role, status, invited_by_email, created_at}]` |
| POST | `/api/team/invites/create/` | Davet oluştur | `{email, role}` | Invite obj |
| DELETE | `/api/team/invites/<id>/cancel/` | Davet iptal | — | 204 |

### Billing

| Method | Path | Auth | Açıklama | İstek | Yanıt |
|---|---|---|---|---|---|
| GET | `/api/billing/plans/` | Yok | Plan listesi | — | `[{id, name, tier, credit_limit, member_limit, features, price_monthly}]` |
| POST | `/api/billing/subscribe/` | Gerekli | Plana abone ol | `{plan_id}` | WorkspaceCredit obj |
| GET | `/api/billing/plan/` | Gerekli | Mevcut plan | — | WorkspaceCredit obj |
| GET | `/api/billing/credits/` | Gerekli | Kredi bakiyesi | — | `{balance, used, total, plan, updated_at}` |
| GET | `/api/billing/transactions/` | Gerekli | İşlem geçmişi (son 50) | — | `[{id, amount, transaction_type, description, created_at}]` |

### Activity

| Method | Path | Açıklama | Yanıt |
|---|---|---|---|
| GET | `/api/activity/events/` | Son 100 event | `[{id, event_type, description, metadata, user_email, created_at}]` |
| GET | `/api/activity/analytics/` | Analitik özet | `{total_events, by_type:[{event_type, count}], daily:[{day, count}], credits:{total, used, remaining}}` |

### Automation

| Method | Path | Açıklama | İstek | Yanıt |
|---|---|---|---|---|
| GET | `/api/automation/` | Otomasyon listesi | — | `[Automation]` |
| POST | `/api/automation/` | Otomasyon oluştur | Bkz. aşağı | Automation obj (201) |
| GET | `/api/automation/<id>/` | Detay | — | Automation obj |
| PATCH | `/api/automation/<id>/` | Güncelle | Herhangi alan | Automation obj |
| DELETE | `/api/automation/<id>/` | Sil | — | 204 |
| POST | `/api/automation/<id>/run/` | Şimdi çalıştır | — | `{run_id}` (202) |
| POST | `/api/automation/<id>/toggle/` | Aktifliği toggle et | — | `{is_active}` |
| GET | `/api/automation/<id>/runs/` | Çalıştırma geçmişi (son 30) | — | `[AutomationRun]` |
| GET | `/api/automation/runs/<run_pk>/status/` | Run durumu (polling) | — | AutomationRun obj |

**Automation istek gövdesi:**
```json
{
  "name": "Daily Buffalo Ads",
  "trigger_type": "manual|scheduled",
  "schedule_time": "09:00",
  "schedule_timezone": "Europe/Istanbul",
  "schedule_days": ["mon", "tue", "wed", "thu", "fri"],
  "model_name": "Nano Banana 2",
  "aspect_ratio": "1:1",
  "resolution": "1K",
  "image_size": "",
  "image_quality": "high",
  "num_images": 2,
  "output_format": "png",
  "extra_prompt": "",
  "static_ids": [1, 2],
  "logo_id": 3
}
```

**Automation yanıt şeması:**
```json
{
  "id": 1,
  "name": "Daily Buffalo Ads",
  "model_name": "Nano Banana 2",
  "aspect_ratio": "1:1",
  "resolution": "1K",
  "image_size": "",
  "image_quality": "high",
  "num_images": 2,
  "output_format": "png",
  "extra_prompt": "",
  "trigger_type": "scheduled",
  "schedule_time": "09:00:00",
  "schedule_timezone": "Europe/Istanbul",
  "schedule_days": ["mon", "wed", "fri"],
  "is_active": true,
  "last_run_at": "2024-01-01T06:00:00Z",
  "next_run_at": "2024-01-03T06:00:00Z",
  "created_at": "2024-01-01T00:00:00Z",
  "static_ids": [1, 2],
  "logo_id": 3,
  "logo_url": "http://localhost:8000/media/logos/...",
  "last_run": {"id": 1, "status": "done", "started_at": "...", "completed_at": "...", "error_message": ""},
  "total_runs": 5,
  "total_creatives": 10
}
```

**AutomationRun yanıt şeması:**
```json
{
  "id": 1,
  "status": "running|done|error",
  "generation_job_id": 5,
  "logo_job_id": 2,
  "started_at": "2024-01-01T09:00:00Z",
  "completed_at": "2024-01-01T09:02:00Z",
  "error_message": "",
  "creatives": [GeneratedCreative]
}
```

---

## Veritabanı Modelleri

### accounts.User
| Alan | Tip | Notlar |
|---|---|---|
| `id` | BigAutoField PK | |
| `email` | EmailField unique | LOGIN alanı (username yerine) |
| `username` | CharField | |
| `first_name` | CharField | |
| `last_name` | CharField | |
| `tier` | CharField | individual / team / enterprise |
| `is_staff` | BooleanField | |
| `is_superuser` | BooleanField | |
| `is_active` | BooleanField | |

### accounts.Workspace
| Alan | Tip | Notlar |
|---|---|---|
| `id` | UUIDField PK | |
| `name` | CharField(100) | |
| `owner` | FK → User | |
| `members` | M2M → User through WorkspaceMember | |
| `tier` | CharField | |
| `created_at` | DateTimeField | |

### accounts.WorkspaceMember
| Alan | Tip | Notlar |
|---|---|---|
| `workspace` | FK | |
| `user` | FK | |
| `role` | CharField | owner / admin / member / viewer |
| `joined_at` | DateTimeField | |
| unique_together | workspace + user | |

### accounts.Invite
| Alan | Tip | Notlar |
|---|---|---|
| `workspace` | FK | |
| `email` | EmailField | |
| `token` | UUIDField unique | Kabul linki için |
| `invited_by` | FK → User | |
| `role` | CharField | admin / member / viewer |
| `status` | CharField | pending / accepted / expired |
| `created_at` | DateTimeField | |

### creatives.GenerationJob
| Alan | Tip | Notlar |
|---|---|---|
| `workspace` | FK | |
| `created_by` | FK → User | |
| `campaign` | FK → Campaign nullable | |
| `disclaimer` | FK → Disclaimer nullable | |
| `statics` | M2M → WinningStatic | Referans fotoğraflar |
| `model_name` | CharField | default: Nano Banana 2 |
| `aspect_ratio` | CharField | 1:1 / 16:9 / 9:16 / 4:5 / 4:3 / 3:2 |
| `resolution` | CharField | 0.5K / 1K / 2K / 4K |
| `num_images` | IntegerField | default: 2 |
| `output_format` | CharField | png / jpeg / webp |
| `generate_new_character` | BooleanField | |
| `image_size` | CharField | GPT Image 2 için: square_hd vb. |
| `image_quality` | CharField | high / medium / low |
| `style` | CharField | realistic / cartoon / textbased / custom |
| `extra_prompt` | TextField | |
| `master_prompt` | TextField | GPT-4.1 tarafından üretilir |
| `character_archetype` | JSONField nullable | |
| `vibe_and_atmosphere` | TextField | |
| `recommended_colors` | JSONField | |
| `status` | CharField | pending / processing / done / error |
| `current_step` | CharField | captioning / generating_prompt / generating_images / saving / done / error |
| `error_message` | TextField | |
| `created_at` | DateTimeField | |

### creatives.GeneratedCreative
| Alan | Tip | Notlar |
|---|---|---|
| `workspace` | FK | |
| `job` | FK → GenerationJob nullable | |
| `campaign` | FK → Campaign nullable | |
| `name` | CharField(255) | |
| `image_url` | URLField(1000) | Orijinal AI görseli — DOKUNULMAZ |
| `thumbnail_url` | URLField(1000) | |
| `logo_applied_url` | URLField(1000) blank | Logolu versiyon (otomasyon sonrası dolar) |
| `media_type` | CharField | Photo / Video |
| `logo_position` | CharField | No Logo / Top-Left / Top-Right / Center / Bottom-Left / Bottom-Right |
| `status` | CharField | default: Ready |
| `compliance` | CharField | default: Verified |
| `created_at` | DateTimeField | |

### creatives.VideoJob
| Alan | Tip | Notlar |
|---|---|---|
| `workspace` | FK | |
| `created_by` | FK → User | |
| `source_creative` | FK → GeneratedCreative nullable | |
| `source_image_url` | URLField(2000) | |
| `prompt` | TextField | default: Smooth cinematic motion |
| `status` | CharField | pending / processing / done / error |
| `video_url` | URLField(2000) blank | Tamamlanınca dolar |
| `error_message` | TextField | |
| `created_at` | DateTimeField | |

### creatives.LogoJob
| Alan | Tip | Notlar |
|---|---|---|
| `workspace` | FK | |
| `created_by` | FK → User | |
| `source_job` | FK → GenerationJob | |
| `status` | CharField | pending / done / error |
| `error_message` | TextField | |
| `created_at` | DateTimeField | |

### creatives.LogoJobImage
| Alan | Tip | Notlar |
|---|---|---|
| `job` | FK → LogoJob | |
| `source_creative` | FK → GeneratedCreative nullable | |
| `file` | ImageField | upload_to: logo_results/ |
| `created_at` | DateTimeField | |

### brand_kit.Campaign
| Alan | Tip | Notlar |
|---|---|---|
| `workspace` | FK | |
| `name` | CharField(100) | |
| `created_by` | FK → User | |
| `created_at` | DateTimeField | |
| unique_together | workspace + name | |

### brand_kit.Logo
| Alan | Tip | Notlar |
|---|---|---|
| `workspace` | FK | |
| `file` | ImageField | upload_to: logos/ |
| `name` | CharField(100) | |
| `is_primary` | BooleanField | |
| `uploaded_at` | DateTimeField | |

### brand_kit.WinningStatic (Referans Fotoğraflar)
| Alan | Tip | Notlar |
|---|---|---|
| `workspace` | FK | |
| `file` | ImageField | upload_to: statics/ |
| `name` | CharField(200) | |
| `caption` | TextField | Florence-2 Large tarafından otomatik üretilir |
| `caption_status` | CharField | pending / processing / done / error |
| `performance` | CharField | |
| `category` | CharField | |
| `uploaded_at` | DateTimeField | |

### brand_kit.Disclaimer
| Alan | Tip | Notlar |
|---|---|---|
| `workspace` | FK | |
| `text` | TextField | |
| `name` | CharField(100) | |
| `category` | CharField | default: General |
| `is_default` | BooleanField | |
| `created_at` | DateTimeField | |

### brand_kit.DisclaimerKeyword
| Alan | Tip | Notlar |
|---|---|---|
| `workspace` | FK | |
| `keyword` | CharField(200) | Blacklist |
| `created_at` | DateTimeField | |
| unique_together | workspace + keyword | |

### team.APIKey
| Alan | Tip | Notlar |
|---|---|---|
| `workspace` | FK | |
| `name` | CharField(100) | |
| `key_prefix` | CharField(12) | Gösterim için (ilk 12 karakter) |
| `key_hash` | CharField(64) | SHA256 hash |
| `created_by` | FK → User | |
| `last_used_at` | DateTimeField nullable | |
| `is_active` | BooleanField | |
| `created_at` | DateTimeField | |
| Format | `tx_live_<40 hex>` | |

### billing.Plan
| Alan | Tip | Notlar |
|---|---|---|
| `name` | CharField(100) | |
| `tier` | CharField | individual / team / enterprise |
| `credit_limit` | IntegerField | |
| `member_limit` | IntegerField | |
| `features` | JSONField | |
| `price_monthly` | DecimalField | |

### billing.WorkspaceCredit
| Alan | Tip | Notlar |
|---|---|---|
| `workspace` | OneToOneField | |
| `plan` | FK → Plan nullable | |
| `balance` | IntegerField | Kalan kredi |
| `used` | IntegerField | Kullanılan kredi |
| `updated_at` | DateTimeField | |

### billing.CreditTransaction
| Alan | Tip | Notlar |
|---|---|---|
| `workspace` | FK | |
| `amount` | IntegerField | |
| `transaction_type` | CharField | credit / debit |
| `description` | CharField(255) | |
| `created_at` | DateTimeField | |

### activity.ActivityEvent
| Alan | Tip | Notlar |
|---|---|---|
| `workspace` | FK | |
| `user` | FK → User nullable | |
| `event_type` | CharField(50) | |
| `description` | CharField(255) | |
| `metadata` | JSONField | |
| `created_at` | DateTimeField | |

### automation.Automation
| Alan | Tip | Notlar |
|---|---|---|
| `workspace` | FK | |
| `created_by` | FK → User nullable | |
| `name` | CharField(255) | |
| `statics` | M2M → WinningStatic | |
| `logo` | FK → Logo nullable | Brand kit logosu |
| `extra_prompt` | TextField | |
| `model_name` | CharField | |
| `aspect_ratio` | CharField | |
| `resolution` | CharField | |
| `image_size` | CharField | |
| `image_quality` | CharField | |
| `num_images` | IntegerField | |
| `output_format` | CharField | |
| `trigger_type` | CharField | manual / scheduled |
| `schedule_time` | TimeField nullable | |
| `schedule_timezone` | CharField(60) | default: UTC — ZoneInfo formatı |
| `schedule_days` | JSONField | `["mon","tue",...]` — boşsa her gün |
| `is_active` | BooleanField | |
| `last_run_at` | DateTimeField nullable | |
| `next_run_at` | DateTimeField nullable | UTC olarak saklanır |
| `created_at` | DateTimeField | |

### automation.AutomationRun
| Alan | Tip | Notlar |
|---|---|---|
| `automation` | FK | |
| `generation_job` | FK → GenerationJob nullable | |
| `logo_job` | FK → LogoJob nullable | |
| `status` | CharField | running / done / error |
| `started_at` | DateTimeField | |
| `completed_at` | DateTimeField nullable | |
| `error_message` | TextField | |

---

## Servis Katmanı

### Görsel Üretimi Akışı

```
generate_job_async(job_id)
  └─ _generate_worker(job_id)  [daemon thread]
       ├─ 1. Referans fotoğrafların caption'larını topla
       │
       ├─ 2. GPT-4.1 (OpenRouter üzerinden) ile master prompt üret
       │      system_instruction içeriği:
       │        - Logo yasağı kuralı
       │        - Disclaimer (sabit metin)
       │        - Para işareti yasağı ($, €, TL)
       │        - Font tutarlılığı kuralı
       │        - style_rule (realistic/cartoon/textbased → VISUAL STYLE NOTE)
       │        - blacklist_rule (disclaimer keyword'leri)
       │        - char_rule (generate_new_character=True ise)
       │      JSON yanıt: master_prompt, vibe_and_atmosphere, recommended_colors, character_archetype
       │
       ├─ 3. İmaj üret (FAL-AI)
       │      Nano Banana 2  → fal-ai/nano-banana-2
       │      GPT Image 2    → openai/gpt-image-2
       │      Grok Imagine   → xai/grok-imagine-image
       │
       ├─ 4. GeneratedCreative kayıtları oluştur
       └─ 5. WorkspaceCredit'ten kredi düş + ActivityEvent logla
```

**Style kuralları (GPT-4 sistem talimatı içine eklenir):**

| Style | Kural |
|---|---|
| `realistic` | VISUAL STYLE NOTE: photorealistic, cinematic lighting, real textures. CTAs/metinler korunur. |
| `cartoon` | VISUAL STYLE NOTE: cartoon/vector illustration, bold outlines, vibrant flat colors. CTAs korunur. |
| `textbased` | VISUAL STYLE NOTE: typography-first, bold text, high contrast, clean shapes. CTAs korunur. |
| `custom` | style_rule boş — GPT extra_prompt'tan alır |

### Caption Akışı

```
caption_static_async(static_id)
  └─ _caption_worker(static_id)  [daemon thread]
       └─ FAL-AI Florence-2 Large → detailed caption
          → WinningStatic.caption + caption_status='done' güncelle
```

### Logo Yerleştirme

```
calculate_logo_placements(job, logo)
  └─ Her creative için:
       ├─ Logo trimle (RGBA alpha bbox)
       ├─ Boyutlandır (görsel genişliğinin %24, yüksekliğinin %20'si max)
       ├─ OpenCV Laplacian edge density ile 4 aday bölge karşılaştır:
       │    top-center (bias 0.85), bottom-center (bias 1.0),
       │    left-mid (bias 1.0), right-mid (bias 1.0)
       └─ too_busy = bool (en iyi bölge skoru > 15.0)

composite_logos_manual(image_url, logos[])
  └─ Her logo için: PIL resize → rotate → opacity → drop shadow (8px blur) → paste
  └─ RGB PIL Image döner

_auto_place_logo(run, job)  [Automation içinde]
  ├─ Her creative için optimal pozisyon bul
  ├─ Logo composite et
  ├─ LogoJobImage olarak kaydet (media/logo_results/)
  └─ creative.logo_applied_url = SITE_BASE_URL + file.url güncelle
     (creative.image_url orijinal kalır — dokunulmaz)
```

### Otomasyon Zamanlayıcısı

```
AutomationConfig.ready()  [apps.py — Django app startup]
  └─ _start_scheduler()  [sadece runserver veya gunicorn'da]
       └─ _scheduler_loop()  [daemon thread]
            ├─ 10s bekleme (Django init için)
            └─ Her 60 saniyede: _check_and_run_due()
                 ├─ next_run_at <= now() AND is_active=True filtrelenmiş Automation'lar
                 ├─ status='running' AutomationRun varsa atla
                 └─ run_automation_async(automation.pk)

_calculate_next_run(automation)
  └─ schedule_timezone (Python zoneinfo.ZoneInfo) ile yerel saatte hesapla
  └─ schedule_days listesine göre filtrele (boşsa her gün)
  └─ UTC'ye çevirerek döner (max 9 gün ilerisi)
  └─ Kaydedilen next_run_at her zaman UTC'dir
```

### Aktivite Event Tipleri

| Event Tipi | Ne Zaman Loglanır |
|---|---|
| `generation_started` | Üretim işi queue'ya alındığında |
| `generation` | Üretim tamamlandığında (X görsel üretildi) |
| `make_video` | Video işi başlatıldığında |
| `campaign_created` | Kampanya oluşturulduğunda |
| `logo_uploaded` | Logo yüklendiğinde |
| `static_uploaded` | Reference photo yüklendiğinde |
| `disclaimer_created` | Disclaimer oluşturulduğunda |
| `api_key_created` | API key oluşturulduğunda |
| `invite_sent` | Davet gönderildiğinde |

---

## Frontend — Tech Stack ve Yapı

### Bağımlılıklar

| Paket | Versiyon | Kullanım |
|---|---|---|
| `react` | ^19.0.1 | UI framework |
| `react-dom` | ^19.0.1 | DOM render |
| `react-router-dom` | ^7.15.1 | Client-side routing |
| `lucide-react` | ^0.546.0 | İkon seti |
| `motion` | ^12.23.24 | Framer Motion animasyonlar |
| `recharts` | ^3.8.1 | Grafik (AreaChart, BarChart) |
| `tailwindcss` | ^4.1.14 | Utility-first CSS |
| `vite` | ^6.2.3 | Build tool (port: 3000) |

### Dizin Yapısı

```
Frontend/src/
├── App.jsx                         Router + tüm route tanımları
├── main.jsx                        React entry point
├── index.css                       Tailwind + Inter/JetBrains Mono fontlar
├── lib/
│   ├── api.js                      Tüm API çağrıları (tüm export'lar burada)
│   └── dashboardData.js            Mock veri (CreativeEditor için)
├── contexts/
│   └── AuthContext.jsx             Global auth state (useAuth hook)
├── components/
│   ├── auth/
│   │   └── ProtectedRoute.jsx      Auth guard + OnboardingRoute
│   ├── dashboard/
│   │   ├── DashboardLayout.jsx     Sidebar + sticky header wrapper
│   │   ├── Sidebar.jsx             Sol navigasyon
│   │   ├── WorkspaceSwitcher.jsx   Workspace dropdown
│   │   └── ProfileDropdown.jsx     Kullanıcı menüsü + logout
│   └── layout/
│       ├── Navbar.jsx              Public nav (scroll-aware)
│       ├── Footer.jsx              Public footer
│       └── Logo.jsx                Logo komponenti
└── pages/
    ├── Home.jsx                    Landing page (animasyonlu)
    ├── Login.jsx                   Login formu
    ├── Contact.jsx                 Kayıt formu
    └── dashboard/
        ├── DashboardHome.jsx       Ana ekran (özet, son görseller)
        ├── GenerateCreatives.jsx   AI üretim (Auto/Manual mode)
        ├── GeneratedCreatives.jsx  Galeri (All/Photos/Videos/With Logo)
        ├── CreativeEditor.jsx      Creative editör (mock data)
        ├── LogoEditor.jsx          Fabric.js canvas logo editörü
        ├── BrandKit.jsx            Marka kiti yönetimi
        ├── TeamWorkspace.jsx       Takım + API Keys
        ├── BillingUsage.jsx        Plan + kredi + grafikler
        ├── Activity.jsx            Event log + analitik
        └── Automation.jsx          Pipeline yönetimi
```

### Tema

- **Arka plan:** #000, #05070a, #0a0d14, #10141d
- **Vurgu:** #3b82f6 (blue-500)
- **Tipografi:** Inter (body), JetBrains Mono (kod/teknik)
- **Efektler:** backdrop-blur, border `white/5 - white/10`, glow shadows
- **Animasyon:** Framer Motion (modal/page transitions), Tailwind animate-spin

---

## Sayfa Kataloğu

### DashboardHome.jsx
**API:** `billingApi.getCredits()` + `activityApi.getAnalytics()` + `creativesApi.gallery()`
**Gösterir:** Workspace adı, kredi kartı (bakiye/kullanılan/plan), son 4 görsel, hızlı işlem sidebar'ı

---

### GenerateCreatives.jsx
**API:** getStatics, getCampaigns, getDisclaimers, generate, jobStatus (polling 3s)

**Sol panel:** Reference photo seçimi (çoklu) + kampanya seçimi + "Yeni kampanya ekle" UI

**Sağ panel — Auto mode:**
- Aspect ratio butonları (1:1 / 9:16 / 16:9 / 4:5)
- Görsel sayısı butonları (1/2/4)
- Disclaimer seçici
- Extra instructions
- Model otomatik tespit: caption'larda karakter → Grok Imagine, yoksa → Nano Banana 2

**Sağ panel — Manual mode:**
- Style grid: Realistic / Cartoon / Text Based / Custom
- Model seçici, Aspect ratio, Resolution, Image size, Image quality
- Görsel sayısı, Output format, Generate new character toggle
- Extra prompt

**Üretim sırasında:** Adım adım pipeline durumu (captioning → generating_prompt → generating_images → saving)

---

### GeneratedCreatives.jsx
**API:** gallery, videoJobsList, logoResultsList, makeVideo, videoJobStatus (polling 3s)

**Sekmeler:**
- All — tüm Photo'lar
- Photos — media_type=Photo
- Videos — VideoJob'lar
- With Logo — LogoJobImage sonuçları

**Her kart:** Thumbnail hover overlay, Make Video butonu, Edit Logo (→ LogoEditor), Download, Delete

---

### LogoEditor.jsx (`/dashboard/logo-editor/:jobId`)
**API:** jobStatus, getLogos, logoPlacementsForJob, logoEditorSave

**Sol:** Brand kit logoları listesi (tıklayınca canvas'a ekler)
**Merkez:** Fabric.js canvas
- Sürükle/bırak, resize, rotate
- Snap guide'ları (14px eşik, yatay + dikey)
- Alt şerit: görsel geçişleri (çok görsellilik)
- Placement verisi image'lar arası korunur
**Sağ:** Scale / Opacity / Angle slider'ları, Sil butonu
**Kaydet:** `logoEditorSave()` → server-side PIL compositing → LogoJobImage kayıtları

---

### BrandKit.jsx
**4 bölüm:**

| Bölüm | Açıklama |
|---|---|
| Logolar | Grid, upload (multipart), delete |
| Reference Photos | Grid + caption_status badge, çoklu upload, delete |
| Kampanyalar | Liste, inline edit (Enter kaydet / Escape iptal), delete, yeni ekle |
| Disclaimer'lar | Liste, delete, yeni ekle (text, name, category, is_default) |

---

### TeamWorkspace.jsx
**3 bölüm:**

| Bölüm | Açıklama |
|---|---|
| Aktif Üyeler | Tablo (avatar initials, isim, email, rol) |
| Bekleyen Davetler | Liste, iptal butonu |
| API Keys | Liste (masked), kopyala, sil; oluşturulduğunda raw key bir kez gösterilir |

---

### BillingUsage.jsx
**API:** getCredits, getTransactions, activityApi.getAnalytics

**Gösterir:**
- Aktif plan kartı
- Kredi bakiyesi progress bar (kullanılan/toplam)
- 12 günlük üretim hızı AreaChart (recharts, gradient fill)
- Kredi işlem listesi (credit/debit badge'li)
- Sağ sidebar: ödeme yöntemi (placeholder VISA ••••4492)

---

### Activity.jsx
**API:** getEvents, getAnalytics

**Gösterir:**
- 14 günlük aktivite AreaChart
- Timeline event stream: timeAgo formatında, event_type'a göre renk kodlu badge

---

### Automation.jsx
**API:** automationApi (list, create, update, delete, runNow, toggle, runs, runStatus), brandKitApi (getStatics, getLogos)

**Liste görünümü:** Automation kartları (isim, status, trigger, model, stats)
**Detay görünümü (karta tıklayınca):**
- Özet kartları (toplam üretim, template sayısı, engine, run sayısı)
- Sol sidebar: pipeline ayarları + custom instructions + run geçmişi
- Sağ: son run görselleri — **CreativeCard** bileşeni (logolu/logosuz toggle)

**CreativeCard davranışı:**
- `logo_applied_url` varsa → varsayılan logolu göster
- Sağ üst köşede "Logo" / "Original" toggle butonu
- `logo_applied_url` yoksa → toggle yok, direkt orijinal

**Modal (5 bölüm):**
1. İsim + Trigger (Manual / Scheduled)
   - Scheduled: Timezone seçici + Saat input + Günler grid
2. Reference photo seçimi (çoklu)
3. Model + Output (model, aspect ratio, resolution, num images, format)
4. Logo seçici (brand kit logoları, "None" seçeneği dahil)
5. Custom instructions textarea

**Timezone listesi:** UTC, Europe/Istanbul, Europe/London, Europe/Berlin, Europe/Moscow, America/New_York, America/Chicago, America/Los_Angeles, Asia/Dubai, Asia/Kolkata, Asia/Singapore, Asia/Tokyo, Australia/Sydney

---

### SelectPlan.jsx + Payment.jsx
**SelectPlan:** `billingApi.getPlans()` → 3 plan kartı → `/onboarding/payment` yönlendir
**Payment:** Kart formu (auto-format: kart no 4'erli gruplar, MM/YY), `billingApi.subscribe()` → başarıda `/dashboard`

---

## API İstemci Katmanı

**Dosya:** `Frontend/src/lib/api.js`
**Base URL:** `/api` (Vite proxy → `http://localhost:8000`)

**Otomatik header'lar:**
```
Authorization: Bearer <localStorage.access_token>
X-Workspace-ID: <localStorage.active_workspace_id>
```

**401 davranışı:** `POST /auth/token/refresh/` → başarısız → localStorage temizle → `/login`

**Tüm export'lar:**
```javascript
authApi = {
  login(email, password),              // POST /auth/token/
  register(data),                       // POST /auth/register/
  setTokens(access, refresh),          // localStorage'a yaz
  clearTokens(),                        // localStorage temizle
  getAccessToken(),                     // localStorage'dan oku
  getRefreshToken(),                    // localStorage'dan oku
  refreshAccessToken(),                 // POST /auth/token/refresh/
  getActiveWorkspaceId(),               // localStorage'dan oku
  setActiveWorkspaceId(id),            // localStorage'a yaz
}

creativesApi = {
  gallery(params),                      // GET /creatives/gallery/{params}
  generate(data),                       // POST /creatives/generate/
  jobStatus(id),                        // GET /creatives/jobs/{id}/
  updateCreative(id, data),             // PATCH /creatives/{id}/
  updateLogo(id, position),            // PATCH /creatives/{id}/logo/
  makeVideo(id, prompt),               // POST /creatives/{id}/make-video/
  videoJobStatus(id),                   // GET /creatives/video-jobs/{id}/
  videoJobsList(),                      // GET /creatives/video-jobs/
  logoPlacementsForJob(jobId, logoId), // GET /creatives/jobs/{jobId}/logo-placements/?logo_id=
  logoEditorSave(jobId, placements),   // POST /creatives/jobs/{jobId}/logo-editor/save/
  deleteCreative(id),                   // DELETE /creatives/{id}/
  logoResultsList(),                    // GET /creatives/logo-results/
}

brandKitApi = {
  getCampaigns(),                       // GET /brand-kit/campaigns/
  createCampaign(name),                // POST /brand-kit/campaigns/
  updateCampaign(id, name),           // PATCH /brand-kit/campaigns/{id}/
  deleteCampaign(id),                  // DELETE /brand-kit/campaigns/{id}/
  getStatics(),                         // GET /brand-kit/statics/
  uploadStatic(formData),              // POST /brand-kit/statics/ (multipart)
  deleteStatic(id),                     // DELETE /brand-kit/statics/{id}/
  getLogos(),                           // GET /brand-kit/logos/
  uploadLogo(formData),                // POST /brand-kit/logos/ (multipart)
  deleteLogo(id),                       // DELETE /brand-kit/logos/{id}/
  getDisclaimers(),                     // GET /brand-kit/disclaimers/
  createDisclaimer(data),              // POST /brand-kit/disclaimers/
  updateDisclaimer(id, data),          // PATCH /brand-kit/disclaimers/{id}/
  deleteDisclaimer(id),                // DELETE /brand-kit/disclaimers/{id}/
}

teamApi = {
  getMembers(),                         // GET /team/members/
  updateMember(id, data),              // PATCH /team/members/{id}/
  removeMember(id),                    // DELETE /team/members/{id}/remove/
  getApiKeys(),                         // GET /team/api-keys/
  createApiKey(name),                  // POST /team/api-keys/
  deleteApiKey(id),                     // DELETE /team/api-keys/{id}/
  getInvites(),                         // GET /team/invites/
  sendInvite(data),                    // POST /team/invites/create/
  cancelInvite(id),                    // DELETE /team/invites/{id}/cancel/
}

billingApi = {
  getPlans(),                           // GET /billing/plans/ (auth yok)
  subscribe(plan_id),                  // POST /billing/subscribe/
  getPlan(),                            // GET /billing/plan/
  getCredits(),                         // GET /billing/credits/
  getTransactions(),                    // GET /billing/transactions/
}

automationApi = {
  list(),                               // GET /automation/
  create(data),                         // POST /automation/
  detail(id),                           // GET /automation/{id}/
  update(id, data),                    // PATCH /automation/{id}/
  delete(id),                           // DELETE /automation/{id}/
  runNow(id),                           // POST /automation/{id}/run/
  toggle(id),                           // POST /automation/{id}/toggle/
  runs(id),                             // GET /automation/{id}/runs/
  runStatus(runPk),                    // GET /automation/runs/{runPk}/status/
}

activityApi = {
  getEvents(),                          // GET /activity/events/
  getAnalytics(),                       // GET /activity/analytics/
}
```

---

## Auth Akışı

```
Login:
  POST /auth/token/ {email, password}
  → {access, refresh} → localStorage (access_token, refresh_token)
  → GET /users/me/ → AuthContext güncelle
  → /dashboard redirect

Kayıt:
  POST /auth/register/ {email, password, first_name, last_name}
  → Başarı ekranı → /login redirect

401 alındığında:
  POST /auth/token/refresh/ {refresh}
  → Yeni access token → localStorage güncelle → isteği tekrar yap
  → Başarısız → localStorage temizle → /login redirect

Logout:
  localStorage temizle → /login redirect

localStorage keys:
  access_token
  refresh_token
  active_workspace_id
```

---

## Routing Tablosu

| Path | Component | Guard |
|---|---|---|
| `/` | Home | — |
| `/login` | Login | — |
| `/contact` | Contact (Kayıt) | — |
| `/product` | → `/#product` | — |
| `/solutions` | → `/#solutions` | — |
| `/pricing` | → `/#pricing` | — |
| `/onboarding` | SelectPlan | Auth + No Plan |
| `/onboarding/payment` | Payment | Auth + No Plan |
| `/dashboard` | DashboardHome | Auth + Active Plan |
| `/dashboard/create` | GenerateCreatives | Auth + Active Plan |
| `/dashboard/creatives` | GeneratedCreatives | Auth + Active Plan |
| `/dashboard/editor/:id` | CreativeEditor | Auth + Active Plan |
| `/dashboard/logo-editor/:jobId` | LogoEditor | Auth + Active Plan |
| `/dashboard/brand-kit` | BrandKit | Auth + Active Plan |
| `/dashboard/team` | TeamWorkspace | Auth + Active Plan |
| `/dashboard/billing` | BillingUsage | Auth + Active Plan |
| `/dashboard/activity` | Activity | Auth + Active Plan |
| `/dashboard/automation` | Automation | Auth + Active Plan |

**Guard mantığı:**
- `ProtectedRoute`: isLoading → spinner, !isAuthenticated → `/login`, !hasActivePlan → `/onboarding`, children render
- `OnboardingRoute`: isLoading → spinner, !isAuthenticated → `/login`, hasActivePlan → `/dashboard`, children render

---

## Global State (AuthContext)

```javascript
const {
  user,              // {id, email, username, first_name, last_name, tier, workspaces:[...]}
  isLoading,         // boolean — başlangıç token kontrolü
  isAuthenticated,   // boolean
  activeWorkspace,   // {id, name, tier, role, ...} objesi
  activeWorkspaceId, // UUID string
  hasActivePlan,     // boolean (workspace.has_plan)
  login,             // async (email, password) → void
  logout,            // () → void
  switchWorkspace,   // (id) → localStorage güncelle + window.location.reload()
  refreshUser,       // async () → void (ödeme sonrası plan yenileme)
} = useAuth()
```

---

## Dış Servis Entegrasyonları

### FAL-AI
**API Key:** env `FAL_KEY`
**Python paketi:** `fal_client`

| Model ID | Kullanım |
|---|---|
| `fal-ai/nano-banana-2` | Varsayılan görsel üretimi |
| `openai/gpt-image-2` | GPT Image 2 |
| `xai/grok-imagine-image` | Grok Imagine |
| `fal-ai/florence-2-large/more-detailed-caption` | Referans fotoğraf caption |
| `fal-ai/kling-video/v3/pro/image-to-video` | Video üretimi |

**Kling Video parametreleri:** `prompt`, `image_url`, `duration` (5s default), `cfg_scale`, `negative_prompt`

### OpenRouter (GPT-4.1)
- FAL-AI router üzerinden erişim
- Model ID: `openai/gpt-4.1`
- Master prompt üretiminde kullanılır
- **Yanıt formatı:** Sadece JSON — `{master_prompt, vibe_and_atmosphere, recommended_colors:[], character_archetype?:{}}`
- JSON parse hatası olursa `re.search(r'\{.*\}', ...)` fallback

### PIL / Pillow
- Logo compositing (resize, rotate, opacity)
- Drop shadow efekti (8px Gaussian blur, 120 opacity)
- PNG/JPEG/WebP dönüşümü

### OpenCV (opsiyonel)
- Laplacian edge density analizi
- Logo için en boş bölgeyi tespit eder
- Kurulu değilse: köşe/kenar yerleştirme fallback

---

## Önemli Davranışlar ve İş Mantığı

### Workspace Scoping
Tüm API istekleri `X-Workspace-ID` taşır. Tüm model sorguları bu workspace'e filtrelenir. `switchWorkspace()` → `window.location.reload()` (sayfayı tamamen yeniler).

### Kredi Sistemi
Her üretilen görsel = 1 kredi. Üretim sonunda:
- `WorkspaceCredit.balance -= created_count`
- `WorkspaceCredit.used += created_count`
- `CreditTransaction` (debit) oluşturulur
- Kredi yetersizse üretim şu an bloklanmıyor (soft limit)

### Auto Model Detection (GenerateCreatives.jsx)
Reference photo caption'larını kontrol eder:
```javascript
CHARACTER_KW = ['character', 'person', 'man', 'woman', 'girl', 'boy', 'player', 'hero', 'mascot']
caption'larda karakter kelimesi varsa → Grok Imagine
yoksa → Nano Banana 2
```

### Otomasyon Logo Davranışı
```
creative.image_url       = orijinal FAL-AI URL (DOKUNULMAZ)
creative.logo_applied_url = http://localhost:8000/media/logo_results/auto_logo_{job_pk}_{creative_pk}.png
```
Frontend'de CreativeCard: `logo_applied_url` varsa varsayılan logolu göster, toggle ile orijinal'e geç.

### Otomasyon Zamanlayıcısı
- `apps.py ready()` → daemon thread başlatılır (yalnızca `runserver` / gunicorn'da)
- Her 60s: `next_run_at <= now()` ve `is_active=True` automation'lar tetiklenir
- Zaten `status='running'` AutomationRun varsa atlanır
- `schedule_timezone` yerel saat → UTC'ye çevrilerek `next_run_at` kaydedilir

### Video Üretimi Polling
- `makeVideo()` → VideoJob (202) döner
- Frontend her 3s `videoJobStatus()` polling yapar
- `status='done'` → `video_url` alanından video stream edilir

### Logo Editor Kaydetme
- Fabric.js canvas state → `{placements:[{creative_id, logos:[{logo_id,x,y,logo_w,logo_h,angle_deg,opacity}]}]}`
- `logoEditorSave()` → server-side PIL compositing → `LogoJobImage` kayıtları
- Yanıt: `{logo_job_id, images:[{id, url, source_creative_id, ...}]}`

### Reference Photo Caption Akışı
- Yükleme anında `caption_static_async()` arka planda tetiklenir
- Florence-2 Large → `caption` alanı + `caption_status='done'`
- `caption_status: pending → processing → done`
- Frontend, generate ekranında tüm statics'leri gösterir (caption durumuna göre filtre yok)

### hasActivePlan Kontrolü
- `/users/me/` yanıtındaki workspace objesi içinde `has_plan: boolean` gelir
- `false` ise → `ProtectedRoute` → `/onboarding` redirect
- `billingApi.subscribe()` sonrası `refreshUser()` çağrılır → `has_plan` güncellenir

---

*Son güncelleme: 2026-06-07*
