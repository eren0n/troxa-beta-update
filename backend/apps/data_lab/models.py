from django.db import models
from django.conf import settings


class AdRecord(models.Model):
    # Ad identity
    ad_id = models.CharField(max_length=64, unique=True, db_index=True)
    ad_name = models.CharField(max_length=512, blank=True)
    campaign_id = models.CharField(max_length=64, blank=True)
    campaign_name = models.CharField(max_length=512, blank=True)
    adset_id = models.CharField(max_length=64, blank=True)
    adset_name = models.CharField(max_length=512, blank=True)
    ad_status = models.CharField(max_length=32, blank=True)

    # Campaign context
    objective = models.CharField(max_length=100, blank=True)
    daily_budget = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    lifetime_budget = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)

    # Creative reference
    creative_image_path = models.CharField(max_length=500, blank=True)
    creative_image_url = models.URLField(max_length=2000, blank=True)

    # Atomic metrics (ground truth — never store derived ratios here)
    impressions = models.BigIntegerField(default=0)
    reach = models.BigIntegerField(default=0)
    clicks = models.BigIntegerField(default=0)
    spend = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    regs = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    # cost_per_reg and cost_per_ftp are fetched directly from Meta API — not computed locally.
    cost_per_reg = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    ftp = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    cost_per_ftp = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    purchases = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    revenue = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    # Purchase ROAS fetched directly from Meta API — not computed from revenue/spend.
    roas = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)

    # Raw Meta API response (verbatim — nothing is lost)
    raw_insights = models.JSONField(null=True, blank=True)
    raw_ad = models.JSONField(null=True, blank=True)

    # Employee annotations
    target_audience = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    personal_rating = models.IntegerField(null=True, blank=True)
    success_rating = models.IntegerField(null=True, blank=True)
    labeled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='labeled_ads',
    )
    labeled_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-spend', 'ad_name']

    def __str__(self):
        return f'{self.ad_name} ({self.ad_id})'

    @property
    def is_labeled(self):
        return bool(
            self.target_audience
            and self.personal_rating is not None
            and self.success_rating is not None
        )
