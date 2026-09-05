# Database Structure v2 — Optimized for PostgreSQL

**Engine:** PostgreSQL  
**Auth:** JWT (djangorestframework-simplejwt)  
**Custom User Model:** `accounts.User`

---

## Mevcut Yapıdan Farklar

| # | Değişiklik | Neden |
|---|-----------|-------|
| 1 | `User.tier` + `Workspace.tier` **kaldırıldı** | Tek kaynak: `Subscription → Plan`. 3 tabloyu senkron tutmak yerine plan bir kez okunur. |
| 2 | `WorkspaceCredit` → **`Subscription`** olarak yeniden tasarlandı | Abonelik yaşam döngüsü (active/canceled/past_due), dönem sıfırlama ve Stripe/Iyzico entegrasyonu için gerekli. |
| 3 | `Workspace.workspace_type` eklendi | Personal ve Team workspace'ler farklı feature setine sahip, plan yerine direkt okunur. |
| 4 | Public ID'lerde **UUIDField** | URL'den enumeration saldırısı önlenir (`/jobs/1502` → kaç iş yapıldığı görünmez). |
| 5 | `JSONField` listler → **`ArrayField`** | PostgreSQL native array: daha hızlı GIN index, `contains` sorguları optimizasyonu. |
| 6 | AI çıktı URL'leri **kendi storage'ına** | FAL'ın geçici linklerine bağımlılık ortadan kalkar, link kırılması olmaz. |

---

## accounts

### User
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK — dahili, URL'de görünmez |
| email | EmailField | unique, USERNAME_FIELD |
| username | CharField(150) | required |
| password | CharField | Django default |
| bio | TextField | |
| location | CharField(100) | |
| timezone | CharField(100) | |
| language | CharField(50) | default: `English` |
| twitter | CharField(100) | |
| linkedin | CharField(200) | |
| website | CharField(200) | |
| avatar | ImageField | upload: `avatars/` (S3) |
| totp_secret | CharField(64) | |
| totp_enabled | BooleanField | default: `False` |

> **Kaldırıldı:** `tier` — kullanıcının yetkisi `workspace → subscription → plan` üzerinden okunur.

**Index:** `email` (zaten unique → otomatik)

---

### Workspace
| Alan | Tip | Notlar |
|------|-----|--------|
| id | UUIDField | PK |
| name | CharField(100) | |
| owner | FK → User | CASCADE, `owned_workspaces` |
| members | M2M → User | through: `WorkspaceMember` |
| workspace_type | CharField(20) | `personal / team` — onboarding'de set edilir |
| created_at | DateTimeField | auto |

> **Kaldırıldı:** `tier` — `Subscription → Plan.tier` üzerinden okunur.  
> **workspace_type neden lazım?** Plan'a bakmadan feature kontrolü yapılabilir. Personal workspace'e team feature'ı açılmaz.

**Index:** `owner_id`, `workspace_type`

---

### WorkspaceMember
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| workspace | FK → Workspace | CASCADE |
| user | FK → User | CASCADE |
| role | CharField(20) | `owner / admin / member / viewer` |
| joined_at | DateTimeField | auto |

> **Unique together:** (workspace, user)  
**Index:** `workspace_id` (üye listesi sorguları)

---

### Invite
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| workspace | FK → Workspace | CASCADE |
| email | EmailField | |
| token | UUIDField | unique — davet linki için |
| invited_by | FK → User | SET_NULL |
| role | CharField(20) | `admin / member / viewer` |
| status | CharField(20) | `pending / accepted / expired` |
| expires_at | DateTimeField | davet son geçerlilik tarihi |
| created_at | DateTimeField | auto |

> **Eklendi:** `expires_at` — expired kontrolü için `status` güncellemek yerine sorgu bazlı yapılabilir.

---

## billing

### Plan
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| name | CharField(100) | |
| tier | CharField(30) | unique — `free / individual / team / enterprise` |
| credit_limit | IntegerField | aylık kredi limiti (0 = unlimited) |
| member_limit | IntegerField | max üye sayısı |
| features | ArrayField(CharField(100)) | ör. `['generate_creative', 'video', 'automation']` |
| price_monthly | DecimalField(10,2) | |
| is_active | BooleanField | default: `True` — eski planları devre dışı bırakmak için |

> **Değişti:** `features` JSONField → `ArrayField` — GIN index ile `features__contains=['automation']` sorgusu hızlı çalışır.

**Planlar ve izinler:**
| tier | credits | seats | features |
|------|---------|-------|---------|
| free | 100 | 1 | `generate_creative` |
| individual | 1000 | 1 | `generate_creative`, `billing`, `creatives`, `activity`, `profile` |
| team | 5000 | 5 | tüm özellikler |
| enterprise | custom | custom | tüm özellikler |

---

### Subscription
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| workspace | OneToOne → Workspace | `subscription` |
| plan | FK → Plan | PROTECT — plan silinmeden önce migration gerekir |
| status | CharField(20) | `trialing / active / canceled / past_due` |
| credit_balance | IntegerField | bu dönemde kalan kredi |
| credit_used | IntegerField | bu dönemde kullanılan kredi |
| current_period_start | DateTimeField | |
| current_period_end | DateTimeField | |
| external_id | CharField(255) | Stripe/Iyzico subscription ID — blank |
| canceled_at | DateTimeField | nullable |
| created_at | DateTimeField | auto |
| updated_at | DateTimeField | auto |

> **Neden WorkspaceCredit yerine Subscription?**  
> `balance + used` yeterliydi ama aylık sıfırlama, ödeme sağlayıcı entegrasyonu ve `past_due` gibi durumlar için dönem bilgisi şart.  
> Dönem sonunda `credit_balance = plan.credit_limit`, `credit_used = 0` reset edilir.

**Index:** `workspace_id`, `status`, `current_period_end`

---

### CreditTransaction
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| workspace | FK → Workspace | CASCADE |
| amount | IntegerField | pozitif = credit, negatif = debit |
| transaction_type | CharField(10) | `credit / debit` |
| description | CharField(255) | |
| reference_type | CharField(50) | hangi işlemden geldiği: `generation / automation / topup` |
| reference_id | UUIDField | nullable — ilgili job/automation UUID'si |
| created_at | DateTimeField | auto |

> **Eklendi:** `reference_type` + `reference_id` — kredi nereye harcandı takip edilebilir.  
> **Değişti:** `amount` artık signed int — tip ayrı alanla desteklenir.

**Index:** `workspace_id`, `created_at` (zaman bazlı billing raporu için)

---

## brand_kit

### Campaign
| Alan | Tip | Notlar |
|------|-----|--------|
| id | UUIDField | PK — URL'de görünür |
| workspace | FK → Workspace | CASCADE |
| name | CharField(100) | |
| created_by | FK → User | SET_NULL |
| created_at | DateTimeField | auto |

> **Değişti:** PK BigAutoField → UUIDField

> **Unique together:** (workspace, name)

---

### Logo
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| workspace | FK → Workspace | CASCADE |
| file | ImageField | upload: `logos/` (S3) |
| name | CharField(100) | |
| is_primary | BooleanField | default: `False` |
| uploaded_at | DateTimeField | auto |

---

### WinningStatic
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| workspace | FK → Workspace | CASCADE |
| file | ImageField | upload: `statics/` (S3) |
| name | CharField(200) | |
| caption | TextField | |
| caption_status | CharField(20) | `pending / processing / done / error` |
| performance | CharField(50) | |
| category | CharField(100) | |
| uploaded_at | DateTimeField | auto |

**Index:** `workspace_id`, `caption_status` (pending işler için polling)

---

### Disclaimer
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| workspace | FK → Workspace | CASCADE |
| text | TextField | |
| name | CharField(100) | |
| category | CharField(100) | default: `General` |
| is_default | BooleanField | |
| created_at | DateTimeField | auto |

---

### DisclaimerKeyword
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| workspace | FK → Workspace | CASCADE |
| keyword | CharField(200) | |
| created_at | DateTimeField | auto |

> **Unique together:** (workspace, keyword)

---

## creatives

### GenerationJob
| Alan | Tip | Notlar |
|------|-----|--------|
| id | UUIDField | PK — URL'de görünür |
| workspace | FK → Workspace | CASCADE |
| created_by | FK → User | SET_NULL |
| campaign | FK → Campaign | SET_NULL |
| disclaimer | FK → Disclaimer | SET_NULL |
| statics | M2M → WinningStatic | |
| model_name | CharField(100) | default: `Nano Banana 2` |
| aspect_ratio | CharField(20) | default: `1:1` |
| resolution | CharField(10) | default: `1K` |
| num_images | SmallIntegerField | default: 2 |
| output_format | CharField(10) | default: `png` |
| generate_new_character | BooleanField | |
| image_size | CharField(50) | |
| image_quality | CharField(20) | default: `high` |
| style | CharField(50) | |
| extra_prompt | TextField | |
| master_prompt | TextField | AI tarafından üretilen prompt |
| vibe_and_atmosphere | TextField | |
| recommended_colors | ArrayField(CharField(7)) | hex kodlar: `['#FF0000', '#00FF00']` |
| character_archetype | JSONField | nullable — karmaşık obje, JSONField kalır |
| status | CharField(20) | `pending / processing / done / error` |
| current_step | CharField(30) | `captioning / generating_prompt / generating_images / saving / done / error` |
| error_message | TextField | |
| created_at | DateTimeField | auto |

> **Değişti:** PK UUID, `recommended_colors` ArrayField, `num_images` SmallIntegerField

**Index:** `workspace_id`, `status`, `created_at`

---

### GeneratedCreative
| Alan | Tip | Notlar |
|------|-----|--------|
| id | UUIDField | PK — URL'de görünür |
| workspace | FK → Workspace | CASCADE |
| job | FK → GenerationJob | SET_NULL |
| campaign | FK → Campaign | SET_NULL |
| name | CharField(255) | |
| image_key | CharField(500) | S3 object key — `creatives/uuid.png` |
| thumbnail_key | CharField(500) | S3 object key — thumbnail |
| logo_applied_key | CharField(500) | S3 object key — logo uygulanmış versiyon |
| media_type | CharField(20) | default: `Photo` |
| logo_position | CharField(30) | default: `No Logo` |
| status | CharField(30) | default: `Ready` |
| compliance | CharField(30) | default: `Verified` |
| aspect_ratio | CharField(20) | default: `1:1` |
| created_at | DateTimeField | auto |

> **Değişti:** PK UUID.  
> `image_url / thumbnail_url / logo_applied_url` (URLField, FAL'ın geçici linki) → `image_key / thumbnail_key / logo_applied_key` (S3 object key).  
> Servis katmanında `settings.MEDIA_URL + key` ile tam URL üretilir. FAL çıktısı önce S3'e kaydedilir, sonra key saklanır.

**Index:** `workspace_id`, `campaign_id`, `created_at`

---

### VideoJob
| Alan | Tip | Notlar |
|------|-----|--------|
| id | UUIDField | PK |
| workspace | FK → Workspace | CASCADE |
| created_by | FK → User | SET_NULL |
| source_creative | FK → GeneratedCreative | SET_NULL |
| source_image_key | CharField(500) | S3 object key (kaynak görsel) |
| prompt | TextField | default: `Smooth cinematic motion` |
| status | CharField(20) | `pending / processing / done / error` |
| video_key | CharField(500) | S3 object key — üretilen video |
| error_message | TextField | |
| created_at | DateTimeField | auto |

> **Değişti:** PK UUID, URLField → S3 key

**Index:** `workspace_id`, `status`

---

### LogoJob
| Alan | Tip | Notlar |
|------|-----|--------|
| id | UUIDField | PK |
| workspace | FK → Workspace | CASCADE |
| created_by | FK → User | SET_NULL |
| source_job | FK → GenerationJob | CASCADE |
| status | CharField(20) | `pending / done / error` |
| error_message | TextField | |
| created_at | DateTimeField | auto |

> **Değişti:** PK UUID

---

### LogoJobImage
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| job | FK → LogoJob | CASCADE, `images` |
| source_creative | FK → GeneratedCreative | SET_NULL |
| file_key | CharField(500) | S3 object key |
| created_at | DateTimeField | auto |

> **Değişti:** `file` ImageField → `file_key` CharField (S3 key)

---

## activity

### ActivityEvent
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK — dahili, URL'de görünmez |
| workspace | FK → Workspace | CASCADE |
| user | FK → User | SET_NULL |
| event_type | CharField(50) | |
| description | CharField(255) | |
| metadata | JSONField | dict — yapısal değil, karmaşık → JSONField kalır |
| created_at | DateTimeField | auto |

**Index:** `workspace_id`, `created_at` — aktivite listesi her zaman workspace + zaman bazlı

---

## automation

### Automation
| Alan | Tip | Notlar |
|------|-----|--------|
| id | UUIDField | PK |
| workspace | FK → Workspace | CASCADE |
| created_by | FK → User | SET_NULL |
| name | CharField(255) | |
| statics | M2M → WinningStatic | |
| logo | FK → Logo | SET_NULL |
| extra_prompt | TextField | |
| model_name | CharField(100) | default: `Nano Banana 2` |
| aspect_ratio | CharField(20) | default: `1:1` |
| resolution | CharField(10) | default: `1K` |
| image_size | CharField(50) | |
| image_quality | CharField(20) | default: `high` |
| num_images | SmallIntegerField | default: 2 |
| output_format | CharField(10) | default: `png` |
| trigger_type | CharField(20) | `manual / scheduled` |
| schedule_time | TimeField | nullable |
| schedule_timezone | CharField(60) | default: `UTC` |
| schedule_days | ArrayField(SmallIntegerField) | 0=Pazartesi … 6=Pazar, ör. `[0, 2, 4]` |
| is_active | BooleanField | default: `True` |
| last_run_at | DateTimeField | nullable |
| next_run_at | DateTimeField | nullable |
| created_at | DateTimeField | auto |

> **Değişti:** PK UUID, `schedule_days` JSONField → ArrayField, `num_images` SmallIntegerField

**Index:** `workspace_id`, `is_active`, `next_run_at` — scheduler'ın sıradaki çalıştırılacakları çekmesi için

---

### AutomationRun
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| automation | FK → Automation | CASCADE |
| generation_job | FK → GenerationJob | SET_NULL |
| logo_job | FK → LogoJob | SET_NULL |
| status | CharField(20) | `running / done / error` |
| started_at | DateTimeField | auto |
| completed_at | DateTimeField | nullable |
| error_message | TextField | |

**Index:** `automation_id`, `started_at`

---

## team

### APIKey
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| workspace | FK → Workspace | CASCADE |
| name | CharField(100) | |
| key_prefix | CharField(20) | görüntüleme: `tx_live_xxxx` |
| key_hash | CharField(64) | SHA-256 — ham key saklanmaz |
| created_by | FK → User | SET_NULL |
| last_used_at | DateTimeField | nullable |
| is_active | BooleanField | default: `True` |
| created_at | DateTimeField | auto |

**Index:** `key_prefix` — doğrulama sırasında prefix ile önce filtrele, sonra hash karşılaştır

---

## İlişki Özeti

```
User ──< WorkspaceMember >── Workspace
                             Workspace.workspace_type = personal | team
                             Workspace ── Subscription ──> Plan
                             Workspace ──< CreditTransaction

Workspace ──< Campaign
Workspace ──< Logo
Workspace ──< WinningStatic
Workspace ──< Disclaimer / DisclaimerKeyword

Workspace ──< GenerationJob ──< GeneratedCreative
                             ──< LogoJob ──< LogoJobImage
                             ──< VideoJob

Workspace ──< Automation ──< AutomationRun

Workspace ──< ActivityEvent
Workspace ──< APIKey
Workspace ──< Invite
```

---

## Plan → Feature Mapping (Permission Logic)

```python
PLAN_FEATURES = {
    'free':        ['generate_creative'],
    'individual':  ['generate_creative', 'billing', 'creatives', 'activity', 'profile'],
    'team':        ['generate_creative', 'video', 'logo', 'billing', 'creatives',
                    'activity', 'profile', 'brand_kit', 'automation', 'integration', 'team'],
    'enterprise':  ['*'],
}
```

Bunun için `Plan.features` ArrayField yerine sabit bu mapping kullanılabilir — features sorgusuna gerek kalmaz, sadece `workspace.subscription.plan.tier` okunur.

---

## Onboarding Sırasında Oluşturulanlar

### SignUp:
```
User ──> Workspace(type=personal) ──> Subscription(plan=free, balance=100)
                                  └─> WorkspaceMember(role=owner)
```

### Upgrade to Individual:
```
Subscription.plan = individual
Subscription.credit_balance = 1000
Subscription.status = active
```

### Create Team Workspace:
```
Workspace(type=team) ──> Subscription(plan=team, balance=5000)
                     └─> WorkspaceMember(role=owner)
```

---

## PostgreSQL Migration Notları

1. **`django-storages` + S3:** `DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'` — ImageField'lar otomatik S3'e yazar.
2. **ArrayField:** `from django.contrib.postgres.fields import ArrayField` — `psycopg2` gerekli.
3. **GIN Index** (ArrayField sorguları için):
   ```python
   from django.contrib.postgres.indexes import GinIndex
   class Meta:
       indexes = [GinIndex(fields=['features'])]  # Plan.features
   ```
4. **UUID default:** `import uuid; default=uuid.uuid4` — PostgreSQL native UUID tipini kullanır.
