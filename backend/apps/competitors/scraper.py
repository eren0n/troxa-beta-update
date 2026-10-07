"""
Read a Facebook page's running ads off the public Meta Ad Library.

Meta's official Ad Library API leaves out commercial ads that only ran in the
US — which is every ad our customers' rivals run — so this reads the public
Ad Library page instead, logged out, the way a person would. The page fetches
its ads from Meta's own GraphQL endpoint; those responses are captured as they
arrive, plus the first batch that ships embedded in the HTML.

Everything Meta-specific lives in this module. If the page changes shape, or
the server's address gets blocked, this is the one file to fix — or to swap
for a paid provider such as ScrapeCreators behind the same fetch_page_ads().
"""
import datetime
import json
import logging
import re
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

AD_LIBRARY_PAGE = (
    'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country={country}'
    '&is_targeted_country=false&media_type=all&search_type=page'
    '&sort_data[direction]=desc&sort_data[mode]=total_impressions&view_all_page_id={page_id}'
)
USER_AGENT = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
              '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36')
MAX_SCROLLS = 40
SCROLL_PAUSE_MS = 2500
# Captured counts below this share of what the page claims are treated as a
# partial read: kept, but not trusted to decide which ads have ended.
COMPLETE_SHARE = 0.9


class ScrapeError(Exception):
    """The page could not be read reliably — blocked, changed, or timed out."""


@dataclass
class ScrapeResult:
    page_id: str
    page_name: str = ''
    ads: list = field(default_factory=list)
    site_count: int | None = None     # what the Ad Library says it holds

    @property
    def complete(self):
        """
        Whether this read can be trusted to say which ads stopped running.

        A blocked or half-loaded page returns too few ads, and treating that
        as "everything else ended" would wipe a rival's whole live set from
        the dashboard in one bad night.
        """
        if self.site_count is None:
            return False
        if self.site_count == 0:
            return len(self.ads) == 0
        return len(self.ads) >= self.site_count * COMPLETE_SHARE


def _date(ts):
    if isinstance(ts, (int, float)):
        return datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).date()
    return None


def _text(value):
    return (value.get('text') if isinstance(value, dict) else value) or ''


def normalise(position, raw):
    """The fields we keep, from one ad as the Ad Library ships it."""
    s = raw.get('snapshot') or {}
    media, cards = [], []
    for i in s.get('images') or []:
        media.append({'type': 'image', 'url': i.get('original_image_url') or i.get('resized_image_url')})
    for v in s.get('videos') or []:
        media.append({'type': 'video', 'url': v.get('video_hd_url') or v.get('video_sd_url'),
                      'preview': v.get('video_preview_image_url')})
    for c in s.get('cards') or []:
        card = {
            'title': c.get('title') or '',
            'body': _text(c.get('body')),
            'link_url': c.get('link_url') or '',
            'cta_text': c.get('cta_text') or '',
            'image': c.get('original_image_url') or c.get('resized_image_url'),
            'video': c.get('video_hd_url') or c.get('video_sd_url'),
        }
        cards.append(card)
        if card['image']:
            media.append({'type': 'image', 'url': card['image']})
        if card['video']:
            media.append({'type': 'video', 'url': card['video'],
                          'preview': c.get('video_preview_image_url')})

    body = _text(s.get('body'))
    # Dynamic creatives ship a template ("{{product.brand}}"); the real copy
    # lives on the cards.
    if '{{' in body and cards:
        body = ' | '.join(dict.fromkeys(c['body'] for c in cards if c['body']))

    start = _date(raw.get('start_date'))
    return {
        'ad_archive_id': str(raw.get('ad_archive_id')),
        'page_id': str(raw.get('page_id') or ''),
        'page_name': raw.get('page_name') or s.get('page_name') or '',
        'position': position,
        'start_date': start,
        'display_format': s.get('display_format') or '',
        'platforms': raw.get('publisher_platform') or [],
        'cta_text': s.get('cta_text') or '',
        'cta_type': s.get('cta_type') or '',
        'link_url': s.get('link_url') or '',
        'title': s.get('title') or '',
        'body': body,
        'media': [m for m in media if m.get('url')],
        'cards': cards,
        'raw': raw,
    }


def _site_count(page_text):
    if re.search(r'no ads match', page_text, re.I):
        return 0
    m = re.search(r'~?\s*([\d,]+)\s+results?', page_text)
    return int(m.group(1).replace(',', '')) if m else None


def fetch_page_ads(page_id, country='US'):
    """
    Every running ad on a page, in the order the Ad Library ranks them by
    impressions. Raises ScrapeError when the page can't be read at all.
    """
    from playwright.sync_api import sync_playwright, Error as PlaywrightError

    found = {}

    def harvest(obj):
        if isinstance(obj, dict):
            if 'ad_archive_id' in obj:
                found.setdefault(str(obj['ad_archive_id']), obj)   # keeps first-seen order
            for v in obj.values():
                harvest(v)
        elif isinstance(obj, list):
            for v in obj:
                harvest(v)

    def harvest_text(text):
        if 'ad_archive_id' not in text:
            return
        for chunk in text.split('\n'):
            chunk = chunk.strip()
            if chunk:
                try:
                    harvest(json.loads(chunk))
                except ValueError:
                    pass

    def on_response(resp):
        if '/api/graphql' in resp.url:
            try:
                harvest_text(resp.text())
            except Exception:
                pass

    url = AD_LIBRARY_PAGE.format(country=country, page_id=page_id)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            try:
                ctx = browser.new_context(viewport={'width': 1400, 'height': 1000},
                                          locale='en-US', user_agent=USER_AGENT)
                page = ctx.new_page()
                page.on('response', on_response)
                page.goto(url, wait_until='domcontentloaded', timeout=60000)
                page.wait_for_timeout(6000)
                for s in page.locator('script[type="application/json"]').all():
                    try:
                        harvest_text(s.inner_text())
                    except Exception:
                        pass
                stale, last = 0, -1
                for _ in range(MAX_SCROLLS):
                    page.mouse.wheel(0, 5000)
                    page.wait_for_timeout(SCROLL_PAUSE_MS)
                    stale = stale + 1 if len(found) == last else 0
                    last = len(found)
                    if stale >= 3:
                        break
                page_text = page.inner_text('body')
            finally:
                browser.close()
    except PlaywrightError as exc:
        raise ScrapeError(f'Ad Library page could not be loaded: {exc}') from exc

    result = ScrapeResult(page_id=str(page_id), site_count=_site_count(page_text))
    # Only this page's ads: a page view can surface others in side panels.
    result.ads = [normalise(i + 1, raw) for i, raw in enumerate(
        a for a in found.values() if str(a.get('page_id') or '') in ('', str(page_id))
    )]
    result.page_name = next((a['page_name'] for a in result.ads if a['page_name']), '')

    if result.site_count is None and not result.ads:
        # Neither a result count nor any ads: a login wall, a block, or a
        # page that changed shape. Say so rather than report "no ads".
        raise ScrapeError('Ad Library page loaded but showed neither results nor a result count')
    return result
