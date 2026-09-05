import uuid
from django.contrib.postgres.fields import ArrayField
from django.db import models
from apps.accounts.models import Workspace, User
from apps.brand_kit.models import WinningStatic, Logo
from apps.creatives.models import GenerationJob, LogoJob, GeneratedCreative


class Automation(models.Model):
    TRIGGER_CHOICES = [('manual', 'Manual'), ('scheduled', 'Scheduled')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='automations')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=255)
    statics = models.ManyToManyField(WinningStatic, blank=True)  # deprecated — see reference_creatives
    reference_creatives = models.ManyToManyField(
        GeneratedCreative, blank=True, related_name='used_as_reference_in_automations',
    )
    logo = models.ForeignKey(Logo, on_delete=models.SET_NULL, null=True, blank=True)
    campaign = models.ForeignKey('brand_kit.Campaign', on_delete=models.SET_NULL, null=True, blank=True)
    character = models.ForeignKey('brand_kit.Character', on_delete=models.SET_NULL, null=True, blank=True)
    extra_prompt = models.TextField(blank=True)
    style = models.CharField(max_length=100, blank=True)
    generation_mode = models.CharField(max_length=20, default='auto')  # 'auto' | 'custom' | 'prompt_studio'
    model_name = models.CharField(max_length=100, default='Nano Banana 2')
    aspect_ratio = models.CharField(max_length=20, default='1:1')
    aspect_ratios = ArrayField(models.CharField(max_length=20), default=list, blank=True)  # multi-ratio support
    resolution = models.CharField(max_length=10, default='1K')
    image_size = models.CharField(max_length=50, blank=True)
    image_quality = models.CharField(max_length=20, default='high')
    num_images = models.SmallIntegerField(default=2)
    output_format = models.CharField(max_length=10, default='png')
    use_fingerprint = models.BooleanField(default=True)
    blend_weight = models.SmallIntegerField(default=50)
    simplicity_weight = models.SmallIntegerField(null=True, blank=True, default=None)
    trigger_type = models.CharField(max_length=20, choices=TRIGGER_CHOICES, default='manual')
    schedule_time = models.TimeField(null=True, blank=True)
    schedule_timezone = models.CharField(max_length=60, default='UTC')
    schedule_days = ArrayField(models.SmallIntegerField(), default=list, blank=True)
    is_active = models.BooleanField(default=True)
    last_run_at = models.DateTimeField(null=True, blank=True)
    next_run_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['workspace', 'is_active']),
            models.Index(fields=['next_run_at']),
        ]

    def __str__(self):
        return self.name


class AutomationRun(models.Model):
    STATUS_CHOICES = [('running', 'Running'), ('done', 'Done'), ('error', 'Error')]

    automation = models.ForeignKey(Automation, on_delete=models.CASCADE, related_name='runs')
    generation_job = models.ForeignKey(GenerationJob, on_delete=models.SET_NULL, null=True, blank=True)
    logo_job = models.ForeignKey(LogoJob, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='running')
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['automation', 'started_at']),
        ]
