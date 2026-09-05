import uuid
from django.db import models
from apps.accounts.models import Workspace, User


class Campaign(models.Model):
    OBJECTIVE_CHOICES = [
        ('acquisition',  'Acquisition'),
        ('retention',    'Retention'),
        ('awareness',    'Brand Awareness'),
        ('reactivation', 'Reactivation'),
        ('event',        'Event / Seasonal'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='campaigns')
    name = models.CharField(max_length=100)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Campaign Intelligence alanları
    target_audience = models.TextField(blank=True, default='')
    target_region   = models.CharField(max_length=200, blank=True, default='')
    objective       = models.CharField(max_length=30, choices=OBJECTIVE_CHOICES, blank=True, default='')
    campaign_brief  = models.TextField(blank=True, default='')

    class Meta:
        unique_together = ('workspace', 'name')

    def __str__(self):
        return self.name


class Logo(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='logos')
    file = models.ImageField(upload_to='logos/')
    name = models.CharField(max_length=100, blank=True)
    is_primary = models.BooleanField(default=False)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name or str(self.id)


class Cta(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='ctas')
    file = models.ImageField(upload_to='ctas/')
    name = models.CharField(max_length=100, blank=True)
    is_primary = models.BooleanField(default=False)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name or str(self.id)


class Promo(models.Model):
    EXTRACTION_STATUS = [('pending','Pending'),('done','Done'),('error','Error')]
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='promos')
    file = models.ImageField(upload_to='promos/')
    name = models.CharField(max_length=100, blank=True)
    is_primary = models.BooleanField(default=False)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    # Verbatim promotional text extracted by Agent 1 vision analysis
    extracted_text = models.TextField(blank=True, default='')
    extraction_status = models.CharField(max_length=20, choices=EXTRACTION_STATUS, default='pending')

    def __str__(self):
        return self.name or str(self.id)


class WinningStatic(models.Model):
    STATUS_CHOICES = [('pending', 'Pending'), ('processing', 'Processing'), ('done', 'Done'), ('error', 'Error')]

    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='statics')
    file = models.ImageField(upload_to='statics/')
    name = models.CharField(max_length=200, blank=True)
    caption = models.TextField(blank=True)
    caption_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    performance = models.CharField(max_length=50, blank=True)
    category = models.CharField(max_length=100, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['workspace', 'caption_status']),
        ]

    def __str__(self):
        return self.name or str(self.id)


class Disclaimer(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='disclaimers')
    text = models.TextField()
    name = models.CharField(max_length=100, blank=True)
    category = models.CharField(max_length=100, default='General')
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name or str(self.id)


class Character(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='characters')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('workspace', 'name')
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class CharacterImage(models.Model):
    STATUS_CHOICES = [('pending', 'Pending'), ('processing', 'Processing'), ('done', 'Done'), ('error', 'Error')]

    character = models.ForeignKey(Character, on_delete=models.CASCADE, related_name='images')
    file = models.ImageField(upload_to='characters/')
    caption = models.TextField(blank=True)
    caption_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f'{self.character.name} image {self.id}'


class PalettePreset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='palette_presets')
    name = models.CharField(max_length=200, default='New Palette')
    active = models.BooleanField(default=False)
    colors = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return self.name


class TypographyPreset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='typography_presets')
    name = models.CharField(max_length=200, default='New Typography')
    active = models.BooleanField(default=False)
    heading = models.CharField(max_length=100, default='Inter')
    body = models.CharField(max_length=100, default='Inter')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return self.name


class DisclaimerKeyword(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='disclaimer_keywords')
    keyword = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('workspace', 'keyword')


class StudioJob(models.Model):
    STATUS_CHOICES = [('pending', 'Pending'), ('done', 'Done'), ('failed', 'Failed')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='studio_jobs')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    result = models.JSONField(null=True, blank=True)
    error = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
