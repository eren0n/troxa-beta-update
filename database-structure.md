# Database Structure

**Engine:** SQLite3 (`backend/db.sqlite3`)  
**Auth:** JWT (djangorestframework-simplejwt)  
**Custom User Model:** `accounts.User`

---

## accounts

### User
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| email | EmailField | unique, USERNAME_FIELD |
| username | CharField | required |
| password | CharField | Django default |
| tier | CharField(30) | default: `individual` |
| bio | TextField | |
| location | CharField(100) | |
| timezone | CharField(100) | |
| language | CharField(50) | default: `English` |
| twitter | CharField(100) | |
| linkedin | CharField(200) | |
| website | CharField(200) | |
| avatar | ImageField | upload: `avatars/` |
| totp_secret | CharField(64) | |
| totp_enabled | BooleanField | default: `False` |

### Workspace
| Alan | Tip | Notlar |
|------|-----|--------|
| id | UUIDField | PK |
| name | CharField(100) | |
| owner | FK → User | CASCADE, `owned_workspaces` |
| members | M2M → User | through: `WorkspaceMember` |
| tier | CharField(30) | default: `individual` |
| created_at | DateTimeField | auto |

### WorkspaceMember
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| workspace | FK → Workspace | CASCADE |
| user | FK → User | CASCADE |
| role | CharField(20) | `owner / admin / member / viewer` |
| joined_at | DateTimeField | auto |
> **Unique together:** (workspace, user)

### Invite
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| workspace | FK → Workspace | CASCADE |
| email | EmailField | |
| token | UUIDField | unique |
| invited_by | FK → User | SET_NULL |
| role | CharField(20) | `admin / member / viewer` |
| status | CharField(20) | `pending / accepted / expired` |
| created_at | DateTimeField | auto |

---

## billing

### Plan
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| name | CharField(100) | |
| tier | CharField(30) | unique — `free / individual / team / enterprise` |
| credit_limit | IntegerField | |
| member_limit | IntegerField | default: 1 |
| features | JSONField | list |
| price_monthly | DecimalField(10,2) | |

### WorkspaceCredit
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| workspace | OneToOne → Workspace | `credit` |
| plan | FK → Plan | SET_NULL |
| balance | IntegerField | mevcut kredi |
| used | IntegerField | kullanılan kredi |
| updated_at | DateTimeField | auto |
> **Property:** `total` = balance + used

### CreditTransaction
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| workspace | FK → Workspace | CASCADE |
| amount | IntegerField | |
| transaction_type | CharField(10) | `credit / debit` |
| description | CharField(255) | |
| created_at | DateTimeField | auto |

---

## brand_kit

### Campaign
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| workspace | FK → Workspace | CASCADE |
| name | CharField(100) | |
| created_by | FK → User | SET_NULL |
| created_at | DateTimeField | auto |
> **Unique together:** (workspace, name)

### Logo
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| workspace | FK → Workspace | CASCADE |
| file | ImageField | upload: `logos/` |
| name | CharField(100) | |
| is_primary | BooleanField | default: `False` |
| uploaded_at | DateTimeField | auto |

### WinningStatic
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| workspace | FK → Workspace | CASCADE |
| file | ImageField | upload: `statics/` |
| name | CharField(200) | |
| caption | TextField | |
| caption_status | CharField(20) | `pending / processing / done / error` |
| performance | CharField(50) | |
| category | CharField(100) | |
| uploaded_at | DateTimeField | auto |

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
| id | BigAutoField | PK |
| workspace | FK → Workspace | CASCADE |
| created_by | FK → User | SET_NULL |
| campaign | FK → Campaign | SET_NULL |
| disclaimer | FK → Disclaimer | SET_NULL |
| statics | M2M → WinningStatic | |
| model_name | CharField(100) | default: `Nano Banana 2` |
| aspect_ratio | CharField(20) | default: `1:1` |
| resolution | CharField(10) | default: `1K` |
| num_images | IntegerField | default: 2 |
| output_format | CharField(10) | default: `png` |
| generate_new_character | BooleanField | |
| image_size | CharField(50) | |
| image_quality | CharField(20) | default: `high` |
| style | CharField(50) | |
| extra_prompt | TextField | |
| master_prompt | TextField | AI tarafından üretilen prompt |
| vibe_and_atmosphere | TextField | |
| recommended_colors | JSONField | list |
| character_archetype | JSONField | nullable |
| status | CharField(20) | `pending / processing / done / error` |
| current_step | CharField(30) | `captioning / generating_prompt / generating_images / saving / done / error` |
| error_message | TextField | |
| created_at | DateTimeField | auto |

### GeneratedCreative
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| workspace | FK → Workspace | CASCADE |
| job | FK → GenerationJob | SET_NULL |
| campaign | FK → Campaign | SET_NULL |
| name | CharField(255) | |
| image_url | URLField(1000) | |
| thumbnail_url | URLField(1000) | |
| logo_applied_url | URLField(1000) | |
| media_type | CharField(20) | default: `Photo` |
| logo_position | CharField(30) | default: `No Logo` |
| status | CharField(30) | default: `Ready` |
| compliance | CharField(30) | default: `Verified` |
| aspect_ratio | CharField(20) | default: `1:1` |
| created_at | DateTimeField | auto |

### VideoJob
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| workspace | FK → Workspace | CASCADE |
| created_by | FK → User | SET_NULL |
| source_creative | FK → GeneratedCreative | SET_NULL |
| source_image_url | URLField(2000) | |
| prompt | TextField | default: `Smooth cinematic motion` |
| status | CharField(20) | `pending / processing / done / error` |
| video_url | URLField(2000) | |
| error_message | TextField | |
| created_at | DateTimeField | auto |

### LogoJob
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| workspace | FK → Workspace | CASCADE |
| created_by | FK → User | SET_NULL |
| source_job | FK → GenerationJob | CASCADE |
| status | CharField(20) | `pending / done / error` |
| error_message | TextField | |
| created_at | DateTimeField | auto |

### LogoJobImage
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| job | FK → LogoJob | CASCADE, `images` |
| source_creative | FK → GeneratedCreative | SET_NULL |
| file | ImageField | upload: `logo_results/` |
| created_at | DateTimeField | auto |

---

## activity

### ActivityEvent
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| workspace | FK → Workspace | CASCADE |
| user | FK → User | SET_NULL |
| event_type | CharField(50) | |
| description | CharField(255) | |
| metadata | JSONField | dict |
| created_at | DateTimeField | auto |

---

## automation

### Automation
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
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
| num_images | IntegerField | default: 2 |
| output_format | CharField(10) | default: `png` |
| trigger_type | CharField(20) | `manual / scheduled` |
| schedule_time | TimeField | nullable |
| schedule_timezone | CharField(60) | default: `UTC` |
| schedule_days | JSONField | list |
| is_active | BooleanField | default: `True` |
| last_run_at | DateTimeField | nullable |
| next_run_at | DateTimeField | nullable |
| created_at | DateTimeField | auto |

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

---

## team

### APIKey
| Alan | Tip | Notlar |
|------|-----|--------|
| id | BigAutoField | PK |
| workspace | FK → Workspace | CASCADE |
| name | CharField(100) | |
| key_prefix | CharField(20) | görüntüleme için (ör. `tx_live_xxxx`) |
| key_hash | CharField(64) | SHA-256 hash, ham key saklanmaz |
| created_by | FK → User | SET_NULL |
| last_used_at | DateTimeField | nullable |
| is_active | BooleanField | default: `True` |
| created_at | DateTimeField | auto |

---

## İlişki Özeti

```
User ──< WorkspaceMember >── Workspace
Workspace ──< WorkspaceCredit >── Plan
Workspace ──< Campaign
Workspace ──< Logo
Workspace ──< WinningStatic
Workspace ──< Disclaimer / DisclaimerKeyword
Workspace ──< GenerationJob ──< GeneratedCreative
                             ──< LogoJob ──< LogoJobImage
                             ──< VideoJob
Workspace ──< Automation ──< AutomationRun
Workspace ──< ActivityEvent
Workspace ──< CreditTransaction
Workspace ──< APIKey
Workspace ──< Invite
```
