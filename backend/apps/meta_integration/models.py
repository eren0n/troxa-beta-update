from django.db import models
from apps.accounts.models import Workspace


class MetaConnection(models.Model):
    """One per workspace — Meta Ads connection via OAuth."""
    workspace       = models.OneToOneField(Workspace, on_delete=models.CASCADE, related_name='meta_connection')
    access_token    = models.TextField()
    token_expires_at = models.DateTimeField(null=True, blank=True)
    fb_user_id      = models.CharField(max_length=50, blank=True)
    fb_user_name    = models.CharField(max_length=200, blank=True)

    # Selected ad account (set after OAuth, during setup step 2)
    ad_account_id   = models.CharField(max_length=50, blank=True)   # e.g. "act_1234567"
    ad_account_name = models.CharField(max_length=200, blank=True)

    # Selected Facebook page (set during setup step 3)
    page_id         = models.CharField(max_length=50, blank=True)
    page_name       = models.CharField(max_length=200, blank=True)

    connected_at    = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.fb_user_name} — {self.workspace.name}'

    @property
    def setup_complete(self):
        return bool(self.ad_account_id and self.page_id)


class MetaCreativeLink(models.Model):
    """Stores the Meta ad IDs created when a creative is posted to Meta Ads."""
    creative        = models.OneToOneField(
        'creatives.GeneratedCreative', on_delete=models.CASCADE, related_name='meta_link'
    )
    ad_id           = models.CharField(max_length=50, blank=True)
    ad_creative_id  = models.CharField(max_length=50, blank=True)
    image_hash      = models.CharField(max_length=100, blank=True)
    campaign_id     = models.CharField(max_length=50, blank=True)
    campaign_name   = models.CharField(max_length=200, blank=True)
    adset_id        = models.CharField(max_length=50, blank=True)
    adset_name      = models.CharField(max_length=200, blank=True)
    linked_at       = models.DateTimeField(auto_now_add=True)

    # Cached metrics (refreshed on demand)
    impressions     = models.BigIntegerField(default=0)
    clicks          = models.BigIntegerField(default=0)
    spend           = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    ctr             = models.DecimalField(max_digits=8, decimal_places=4, default=0)
    cpm             = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    reach           = models.BigIntegerField(default=0)
    metrics_updated_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f'{self.creative.name} → ad {self.ad_id}'
