"""
Keeping each followed competitor's ads in step with the Ad Library.

A sync reads the page's running ads, upserts them, and — only when the read is
verifiably complete — marks the ads that stopped appearing as ended. Syncs run
once a day per competitor from the background scheduler, and on demand.
"""
import logging
import re
import threading
from datetime import timedelta

from django.db import close_old_connections
from django.utils import timezone

from .models import Competitor, CompetitorAd
from .scraper import ScrapeError, fetch_page_ads

logger = logging.getLogger(__name__)

SYNC_EVERY = timedelta(days=1)
# A failed read is retried sooner than a day, but not hammered: Meta is the
# one most likely to be blocking us, and retrying fast makes that worse.
RETRY_AFTER_ERROR = timedelta(hours=3)
MAX_COMPETITORS_PER_WORKSPACE = 20

# One headless browser at a time per process. Each gunicorn worker runs its own
# scheduler, so the claim below keeps them on different pages; this keeps a
# single worker from opening several Chromiums at once.
_browser_slot = threading.Semaphore(1)

_PAGE_ID = re.compile(r'^\d{5,20}$')
_PAGE_ID_IN_URL = re.compile(r'(?:view_all_page_id|page_id|id)=(\d{5,20})')


def parse_page_id(value):
    """
    A page id from what someone pasted: the bare id, or an Ad Library URL
    carrying view_all_page_id. Returns None for anything else.
    """
    value = (value or '').strip()
    if _PAGE_ID.match(value):
        return value
    m = _PAGE_ID_IN_URL.search(value)
    return m.group(1) if m else None


def sync_competitor(competitor):
    """
    Bring one competitor's ads up to date. Returns a small summary dict.
    A failed or unverifiable read never marks an ad as ended.
    """
    now = timezone.now()
    try:
        with _browser_slot:
            result = fetch_page_ads(competitor.page_id)
    except ScrapeError as exc:
        competitor.last_error = str(exc)[:1000]
        competitor.next_sync_at = now + RETRY_AFTER_ERROR
        competitor.save(update_fields=['last_error', 'next_sync_at'])
        logger.warning('competitors.sync_failed competitor=%s error=%s', competitor.pk, exc)
        return {'ok': False, 'error': competitor.last_error}

    seen, created_count = set(), 0
    for ad in result.ads:
        seen.add(ad['ad_archive_id'])
        _, created = CompetitorAd.objects.update_or_create(
            competitor=competitor, ad_archive_id=ad['ad_archive_id'],
            defaults={
                'is_active': True,
                'ended_at': None,        # it is running again if it had been marked ended
                'last_seen_at': now,
                'position': ad['position'],
                'start_date': ad['start_date'],
                'display_format': ad['display_format'],
                'platforms': ad['platforms'],
                'cta_text': ad['cta_text'][:128],
                'cta_type': ad['cta_type'][:64],
                'link_url': ad['link_url'][:2000],
                'title': ad['title'],
                'body': ad['body'],
                'media': ad['media'],     # fresh signed URLs
                'cards': ad['cards'],
                'raw': ad['raw'],
            },
        )
        created_count += created

    ended = 0
    if result.complete:
        ended = (CompetitorAd.objects
                 .filter(competitor=competitor, is_active=True)
                 .exclude(ad_archive_id__in=seen)
                 .update(is_active=False, ended_at=now, position=None))
        competitor.last_error = ''
    else:
        # Kept what we read, but too little to say what stopped running.
        competitor.last_error = (
            f'Partial read: the Ad Library listed {result.site_count} ads, '
            f'{len(result.ads)} were captured. Nothing was marked as ended.'
        )

    if result.page_name:
        competitor.page_name = result.page_name[:255]
    competitor.last_synced_at = now
    competitor.next_sync_at = now + SYNC_EVERY
    competitor.save(update_fields=['page_name', 'last_synced_at', 'next_sync_at', 'last_error'])

    summary = {'ok': True, 'complete': result.complete, 'captured': len(result.ads),
               'site_count': result.site_count, 'new': created_count, 'ended': ended}
    logger.info('competitors.synced competitor=%s %s', competitor.pk, summary)
    return summary


def claim(competitor):
    """
    Atomically take a competitor for syncing; False if someone else has it.
    The same compare-and-clear the automation scheduler uses on next_run_at.
    """
    return bool(Competitor.objects
                .filter(pk=competitor.pk, next_sync_at=competitor.next_sync_at)
                .update(next_sync_at=None))


def sync_in_background(competitor_id):
    def run():
        close_old_connections()
        try:
            competitor = Competitor.objects.filter(pk=competitor_id).first()
            if competitor:
                sync_competitor(competitor)
        except Exception:
            logger.exception('competitors.sync_crashed competitor=%s', competitor_id)
            # never leave it unclaimed forever
            Competitor.objects.filter(pk=competitor_id, next_sync_at__isnull=True).update(
                next_sync_at=timezone.now() + RETRY_AFTER_ERROR)
        finally:
            close_old_connections()
    threading.Thread(target=run, daemon=True, name=f'competitor-sync-{competitor_id}').start()


def sync_due_competitors():
    """Called from the scheduler loop: start one due sync, if any is waiting."""
    due = (Competitor.objects
           .filter(next_sync_at__lte=timezone.now())
           .order_by('next_sync_at')
           .first())
    if due and claim(due):
        sync_in_background(due.pk)
