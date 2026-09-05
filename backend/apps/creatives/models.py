import uuid
from django.contrib.postgres.fields import ArrayField
from django.db import models
from apps.accounts.models import Workspace, User
from apps.brand_kit.models import Campaign, Disclaimer, WinningStatic


class GenerationJob(models.Model):
    STATUS_CHOICES = [('pending', 'Pending'), ('processing', 'Processing'), ('done', 'Done'), ('error', 'Error')]
    STEP_CHOICES = [
        ('captioning', 'Captioning'), ('generating_prompt', 'Generating Prompt'),
        ('generating_images', 'Generating Images'), ('saving', 'Saving'),
        ('done', 'Done'), ('error', 'Error'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='generation_jobs')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    campaign = models.ForeignKey(Campaign, on_delete=models.SET_NULL, null=True, blank=True)
    disclaimer = models.ForeignKey(Disclaimer, on_delete=models.SET_NULL, null=True, blank=True)
    statics = models.ManyToManyField(WinningStatic, blank=True)  # deprecated — see reference_creatives
    reference_creatives = models.ManyToManyField(
        'GeneratedCreative', blank=True, related_name='used_as_reference_in_jobs',
    )
    logo = models.ForeignKey('brand_kit.Logo', on_delete=models.SET_NULL, null=True, blank=True)
    character = models.ForeignKey('brand_kit.Character', on_delete=models.SET_NULL, null=True, blank=True, related_name='generation_jobs')

    generation_mode = models.CharField(max_length=20, default='auto')  # 'auto' | 'custom' | 'prompt_studio'
    model_name = models.CharField(max_length=100, default='Nano Banana 2')
    aspect_ratio = models.CharField(max_length=20, default='1:1')
    resolution = models.CharField(max_length=10, default='1K')
    num_images = models.SmallIntegerField(default=2)
    output_format = models.CharField(max_length=10, default='png')
    generate_new_character = models.BooleanField(default=False)
    image_size = models.CharField(max_length=50, blank=True, null=True, default='')
    image_quality = models.CharField(max_length=20, default='high')
    style = models.CharField(max_length=50, blank=True, null=True, default='')
    extra_prompt = models.TextField(blank=True, null=True, default='')
    negative_prompt = models.TextField(blank=True, default='')
    use_fingerprint = models.BooleanField(default=False)
    # 0 = pure references, 50 = balanced, 100 = pure fingerprint
    # Only meaningful when both use_fingerprint=True and reference_creatives exist
    blend_weight = models.SmallIntegerField(default=50)
    # None = simplicity mode off; 0-100 = on (0 = rich/detailed, 100 = ultra-minimal)
    simplicity_weight = models.SmallIntegerField(null=True, blank=True, default=None)

    master_prompt = models.TextField(blank=True)
    vibe_and_atmosphere = models.TextField(blank=True)
    recommended_colors = ArrayField(models.CharField(max_length=7), default=list, blank=True)
    character_archetype = models.JSONField(null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    current_step = models.CharField(max_length=30, choices=STEP_CHOICES, default='captioning')
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['workspace', 'status']),
            models.Index(fields=['workspace', 'created_at']),
        ]


class CreativeQualityScore(models.Model):
    STATUS_CHOICES = [('pending','Pending'),('done','Done'),('error','Error')]
    VERDICT_CHOICES = [('pass','Pass'),('review','Review'),('fail','Fail')]

    creative = models.OneToOneField('GeneratedCreative', on_delete=models.CASCADE, related_name='quality_score')
    # Individual dimension scores (1-5)
    brand_alignment    = models.SmallIntegerField(null=True, blank=True)
    ad_effectiveness   = models.SmallIntegerField(null=True, blank=True)
    text_quality       = models.SmallIntegerField(null=True, blank=True)
    production_quality = models.SmallIntegerField(null=True, blank=True)
    offer_accuracy     = models.SmallIntegerField(null=True, blank=True)
    # Claude's holistic overall score (1.0–5.0)
    overall  = models.FloatField(null=True, blank=True)
    verdict  = models.CharField(max_length=10, choices=VERDICT_CHOICES, null=True, blank=True)
    notes    = models.TextField(blank=True)
    status   = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    evaluated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=['status'])]


class CreativeTag(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='creative_tags')
    name = models.CharField(max_length=64)
    color = models.CharField(max_length=7, default='#6366f1')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('workspace', 'name')
        ordering = ['name']

    def __str__(self):
        return self.name


class GeneratedCreative(models.Model):
    SOURCE_CHOICES = [('troxa_generated', 'Troxa Generated'), ('uploaded', 'Uploaded')]
    CAPTION_STATUS_CHOICES = [('pending', 'Pending'), ('processing', 'Processing'), ('done', 'Done'), ('error', 'Error')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='creatives')
    job = models.ForeignKey(GenerationJob, on_delete=models.SET_NULL, null=True, blank=True, related_name='creatives')
    campaign = models.ForeignKey(Campaign, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=255)
    image_url = models.URLField(max_length=2000)
    thumbnail_url = models.URLField(max_length=2000, blank=True)
    logo_applied_url = models.URLField(max_length=2000, blank=True)
    uploaded_file = models.FileField(upload_to='creative_uploads/', null=True, blank=True)
    media_type = models.CharField(max_length=20, default='Photo')
    logo_position = models.CharField(max_length=30, default='No Logo')
    status = models.CharField(max_length=30, default='Ready')
    compliance = models.CharField(max_length=30, default='Verified')
    aspect_ratio = models.CharField(max_length=20, default='1:1')
    rating = models.SmallIntegerField(null=True, blank=True)
    feedback_text = models.TextField(blank=True)
    in_gallery = models.BooleanField(default=True)

    # Unified creative table fields
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='troxa_generated', db_index=True)
    is_edited = models.BooleanField(default=False, db_index=True)
    # The workspace member responsible for generating/uploading/editing this
    # creative — a real reference (not a name snapshot) so filtering by
    # person survives renames and still works for members who've since left
    # the workspace (their User row isn't deleted, just the membership).
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='authored_creatives')
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='uploaded_creatives')

    # Custom user tags
    tags = models.ManyToManyField(CreativeTag, blank=True, related_name='creatives')

    # Every creative (generated, uploaded, or edited) is captioned in the
    # background so it can also be picked as a reference photo for future
    # generations — mirrors the old WinningStatic captioning behavior.
    caption = models.TextField(blank=True)
    caption_status = models.CharField(max_length=20, choices=CAPTION_STATUS_CHOICES, default='done')

    # Carried over from the merged-in WinningStatic (reference photo) table;
    # blank for every regular creative.
    performance = models.CharField(max_length=50, blank=True)
    category = models.CharField(max_length=100, blank=True)
    legacy_static_id = models.IntegerField(null=True, blank=True, editable=False, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'creatives'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['workspace', 'campaign']),
            models.Index(fields=['workspace', 'created_at']),
            models.Index(fields=['workspace', 'source']),
            models.Index(fields=['workspace', 'media_type']),
        ]


class VideoJob(models.Model):
    STATUS_CHOICES = [('pending', 'Pending'), ('processing', 'Processing'), ('done', 'Done'), ('error', 'Error')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='video_jobs')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    source_creative = models.ForeignKey(GeneratedCreative, on_delete=models.SET_NULL, null=True, blank=True, related_name='video_jobs')
    source_image_url = models.URLField(max_length=2000)
    prompt = models.TextField(default='Smooth cinematic motion')
    duration = models.SmallIntegerField(default=5)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    video_url = models.URLField(max_length=2000, blank=True)
    fal_request_id = models.CharField(max_length=200, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['workspace', 'status']),
        ]


class LogoJob(models.Model):
    STATUS_CHOICES = [('pending', 'Pending'), ('done', 'Done'), ('error', 'Error')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='logo_jobs')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    source_job = models.ForeignKey(GenerationJob, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class LogoJobImage(models.Model):
    job = models.ForeignKey(LogoJob, on_delete=models.CASCADE, related_name='images')
    source_creative = models.ForeignKey(GeneratedCreative, on_delete=models.SET_NULL, null=True, blank=True)
    file = models.ImageField(upload_to='logo_results/')
    created_at = models.DateTimeField(auto_now_add=True)
