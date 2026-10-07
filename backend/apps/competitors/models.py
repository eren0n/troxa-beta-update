from datetime import date

from django.db import models

from apps.accounts.models import User, Workspace


class Competitor(models.Model):
    """A rival's Facebook page whose ads a workspace follows."""
    workspace     = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='competitors')
    page_id       = models.CharField(max_length=32)
    # Filled in from the Ad Library on the first successful sync.
    page_name     = models.CharField(max_length=255, blank=True, default='')
    # Where the ads ran, as the Ad Library filters it: an ISO country code, or
    # ALL. Not where we look from — that is the server's own location.
    country       = models.CharField(max_length=3, default='US')
    created_by    = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)

    last_synced_at = models.DateTimeField(null=True, blank=True)
    # Cleared while a sync is claimed, so two gunicorn workers never scrape
    # the same page at once — the same atomic claim automations use.
    next_sync_at   = models.DateTimeField(null=True, blank=True, db_index=True)
    last_error     = models.TextField(blank=True, default='')

    class Meta:
        unique_together = ('workspace', 'page_id', 'country')
        ordering = ['page_name', 'page_id']

    def __str__(self):
        return f'{self.page_name or self.page_id} ({self.workspace})'

    @property
    def ad_library_url(self):
        return ('https://www.facebook.com/ads/library/?active_status=active&ad_type=all'
                f'&country={self.country}&media_type=all&search_type=page&view_all_page_id={self.page_id}')


class CompetitorAd(models.Model):
    """One ad as the Ad Library shows it, kept across daily syncs."""
    competitor     = models.ForeignKey(Competitor, on_delete=models.CASCADE, related_name='ads')
    ad_archive_id  = models.CharField(max_length=32)

    is_active      = models.BooleanField(default=True, db_index=True)
    start_date     = models.DateField(null=True, blank=True)
    # When we stopped seeing it. The Ad Library only lists running ads, so an
    # ad missing from a verified sync has ended.
    ended_at       = models.DateTimeField(null=True, blank=True)
    first_seen_at  = models.DateTimeField(auto_now_add=True)
    last_seen_at   = models.DateTimeField(null=True, blank=True)
    # Rank on the page when sorted by total impressions — Meta discloses no
    # numbers for US commercial ads, but it does disclose the order.
    position       = models.PositiveIntegerField(null=True, blank=True)

    display_format = models.CharField(max_length=32, blank=True, default='')
    platforms      = models.JSONField(default=list, blank=True)
    cta_text       = models.CharField(max_length=128, blank=True, default='')
    cta_type       = models.CharField(max_length=64, blank=True, default='')
    link_url       = models.URLField(max_length=2000, blank=True, default='')
    title          = models.TextField(blank=True, default='')
    body           = models.TextField(blank=True, default='')
    # [{type: image|video, url, preview}] — Meta's signed URLs expire after a
    # few days, so these are refreshed on every sync while the ad runs.
    media          = models.JSONField(default=list, blank=True)
    cards          = models.JSONField(default=list, blank=True)
    raw            = models.JSONField(default=dict, blank=True)

    # What an AI read of the ad's images found (see analysis.py). Done once,
    # while the media links are still fresh, so it outlives the media. Video
    # ads are skipped for now.
    ANALYSIS_STATUS = [('', 'Not yet'), ('done', 'Done'), ('failed', 'Failed'), ('skipped', 'Skipped')]
    analysis        = models.JSONField(default=dict, blank=True)
    analysis_status = models.CharField(max_length=16, choices=ANALYSIS_STATUS, blank=True, default='',
                                       db_index=True)
    analysis_error  = models.TextField(blank=True, default='')
    analyzed_at     = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('competitor', 'ad_archive_id')
        ordering = ['position', '-start_date']

    def __str__(self):
        return f'{self.competitor} #{self.ad_archive_id}'

    @property
    def days_running(self):
        """How long it has run — the one success signal Meta gives for US ads."""
        if not self.start_date:
            return None
        until = self.ended_at.date() if (not self.is_active and self.ended_at) else date.today()
        return max(0, (until - self.start_date).days)

    @property
    def ad_library_url(self):
        return f'https://www.facebook.com/ads/library/?id={self.ad_archive_id}'
