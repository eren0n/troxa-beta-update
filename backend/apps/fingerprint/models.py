from django.db import models


class WorkspaceTrendBrief(models.Model):
    """Daily trend-scouting agent output — one per workspace per day.

    The Trend Scout agent searches current iGaming/Meta static-image ad trends
    and produces 5-8 creative generation ideas (each with a ready-to-use
    extra_prompt snippet).  The frontend shows these as selectable idea cards
    in the auto-mode generation panel.
    """
    STATUS = [('pending', 'Pending'), ('ready', 'Ready'), ('failed', 'Failed')]

    workspace  = models.ForeignKey(
        'accounts.Workspace', on_delete=models.CASCADE, related_name='trend_briefs'
    )
    status     = models.CharField(max_length=20, choices=STATUS, default='pending')
    # List of trend idea dicts — see TrendScoutOutput schema in services.py
    ideas      = models.JSONField(default=list)
    landscape_summary = models.TextField(blank=True, default='')
    error      = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'fingerprint_workspacetrendbrief'
        ordering = ['-created_at']

    def __str__(self):
        return f"TrendBrief({self.workspace_id}, {self.status}, {self.created_at.date() if self.created_at else '?'})"


class CampaignMarketInsight(models.Model):
    """Agent 1 (Market Analyst) output — one per Campaign."""
    STATUS = [('pending', 'Pending'), ('ready', 'Ready'), ('failed', 'Failed')]

    campaign  = models.OneToOneField(
        'brand_kit.Campaign', on_delete=models.CASCADE, related_name='market_insight'
    )
    workspace = models.ForeignKey(
        'accounts.Workspace', on_delete=models.CASCADE, related_name='market_insights'
    )
    report     = models.JSONField(default=dict)
    status     = models.CharField(max_length=20, choices=STATUS, default='pending')
    error      = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'fingerprint_campaignmarketinsight'
        ordering = ['-updated_at']

    def __str__(self):
        return f"MarketInsight({self.campaign_id}, {self.status})"


class CampaignCreativeBrief(models.Model):
    """Agent 2 (Creative Director) output — versioned per fingerprint, multiple per Campaign."""
    STATUS = [('pending', 'Pending'), ('ready', 'Ready'), ('failed', 'Failed')]

    campaign            = models.ForeignKey(
        'brand_kit.Campaign', on_delete=models.CASCADE, related_name='creative_briefs'
    )
    workspace           = models.ForeignKey(
        'accounts.Workspace', on_delete=models.CASCADE, related_name='creative_briefs'
    )
    market_insight      = models.ForeignKey(
        CampaignMarketInsight, on_delete=models.SET_NULL, null=True
    )
    fingerprint_version = models.IntegerField(default=0)
    briefs              = models.JSONField(default=list)
    status              = models.CharField(max_length=20, choices=STATUS, default='pending')
    error               = models.TextField(blank=True, default='')
    created_at          = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'fingerprint_campaigncreativebrief'
        ordering = ['-created_at']

    def __str__(self):
        return f"CreativeBrief({self.campaign_id}, fp_v{self.fingerprint_version}, {self.status})"


class BrandFingerprint(models.Model):
    """
    One per workspace. Holds the synthesized brand identity used by Agent 3
    to enrich generation prompts. Populated/updated by Agent 2 (brand_profile)
    and Agent 4 / Synthesis (visual_dna, negative_patterns).
    """
    CONFIDENCE_CHOICES = [("low", "low"), ("medium", "medium"), ("high", "high")]

    workspace = models.OneToOneField(
        "accounts.Workspace",
        on_delete=models.CASCADE,
        related_name="fingerprint",
    )

    # Agent 2 output — brand kit analysis
    brand_profile = models.JSONField(default=dict, blank=True)
    brand_profile_version = models.PositiveIntegerField(default=0)

    # Agent 4 / Synthesis output — recurring visual patterns from corpus
    visual_dna = models.JSONField(default=dict, blank=True)
    negative_patterns = models.JSONField(default=dict, blank=True)
    visual_dna_version = models.PositiveIntegerField(default=0)
    confidence = models.CharField(max_length=10, choices=CONFIDENCE_CHOICES, default="low")
    based_on_image_count = models.PositiveIntegerField(default=0)

    last_full_recreate_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "fingerprint_brandfingerprint"

    def __str__(self):
        return f"BrandFingerprint({self.workspace_id})"


class ImageAnalysisRecord(models.Model):
    """
    Corpus table. One row per analyzed image (gallery upload or rated generation).
    Agent 1 populates `analysis`. Agent 4 reads unprocessed rows (delta).
    Synthesis reads the full table.
    """
    SOURCE_GALLERY = "gallery"
    SOURCE_GENERATION = "generation"
    SOURCE_CHOICES = [
        (SOURCE_GALLERY, "Gallery upload"),
        (SOURCE_GENERATION, "Generation result"),
    ]

    SENTIMENT_POSITIVE = "positive"
    SENTIMENT_NEUTRAL = "neutral"
    SENTIMENT_NEGATIVE = "negative"
    SENTIMENT_CHOICES = [
        (SENTIMENT_POSITIVE, "Positive"),
        (SENTIMENT_NEUTRAL, "Neutral"),
        (SENTIMENT_NEGATIVE, "Negative"),
    ]

    workspace = models.ForeignKey(
        "accounts.Workspace",
        on_delete=models.CASCADE,
        related_name="fingerprint_corpus",
    )
    # The public URL of the analyzed image (fal CDN URL for local files,
    # or GeneratedCreative.image_url for generated creatives)
    image_url = models.URLField(max_length=2000)

    source = models.CharField(max_length=20, choices=SOURCE_CHOICES)

    # Optional FK to the source object for deduplication
    creative = models.ForeignKey(
        "creatives.GeneratedCreative",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="fingerprint_records",
    )
    winning_static = models.ForeignKey(
        "brand_kit.WinningStatic",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="fingerprint_records",
    )

    # 1-10; None for gallery uploads (treated as strong positive)
    rating = models.PositiveSmallIntegerField(null=True, blank=True)
    sentiment = models.CharField(
        max_length=10,
        choices=SENTIMENT_CHOICES,
        default=SENTIMENT_POSITIVE,
    )

    # Agent 1 output — full visual analysis JSON
    analysis = models.JSONField(default=dict)

    # Delta marker: null = not yet merged into fingerprint; set after Agent 4 / Synthesis
    included_in_fingerprint_version = models.PositiveIntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "fingerprint_imageanalysisrecord"
        indexes = [
            models.Index(fields=["workspace", "included_in_fingerprint_version"]),
            models.Index(fields=["workspace", "source"]),
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

    def __str__(self):
        return f"ImageAnalysisRecord({self.workspace_id}, {self.source}, rating={self.rating})"
