import json
from datetime import date, timedelta
from unittest import mock

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User, Workspace, WorkspaceMember
from .models import Competitor, CompetitorAd
from .scraper import ScrapeError, ScrapeResult, normalise
from .services import (
    MAX_COMPETITORS_PER_WORKSPACE, claim, parse_page_id, sync_competitor, sync_due_competitors,
)

PAGE = '630357586831389'


def ad(ad_id, position, started_days_ago=10, fmt='VIDEO', body='Claim 50 Free Spins'):
    return {
        'ad_archive_id': ad_id, 'page_id': PAGE, 'page_name': 'Topdog Games',
        'position': position, 'start_date': date.today() - timedelta(days=started_days_ago),
        'display_format': fmt, 'platforms': ['FACEBOOK', 'INSTAGRAM'],
        'cta_text': 'Play game', 'cta_type': 'PLAY_GAME', 'link_url': 'https://apps.apple.com/x',
        'title': 'Play in Your State', 'body': body,
        'media': [{'type': 'video', 'url': f'https://video.fbcdn/{ad_id}.mp4'}],
        'cards': [], 'raw': {'ad_archive_id': ad_id},
    }


def scraped(*ads, site_count=None):
    return ScrapeResult(page_id=PAGE, page_name='Topdog Games', ads=list(ads),
                        site_count=len(ads) if site_count is None else site_count)


class ParsePageIdTests(TestCase):
    def test_a_bare_id(self):
        self.assertEqual(parse_page_id(f'  {PAGE} '), PAGE)

    def test_an_ad_library_link(self):
        url = ('https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US'
               f'&search_type=page&view_all_page_id={PAGE}')
        self.assertEqual(parse_page_id(url), PAGE)

    def test_anything_else_is_refused(self):
        for junk in ('', 'topdog', 'https://facebook.com/topdoggames', '12', 'abc123456789'):
            self.assertIsNone(parse_page_id(junk))


class NormaliseTests(TestCase):
    def test_dynamic_creatives_take_their_copy_from_the_cards(self):
        raw = {'ad_archive_id': 1, 'page_id': PAGE, 'start_date': 1790000000, 'snapshot': {
            'body': {'text': '{{product.brand}}'}, 'display_format': 'DCO',
            'cards': [
                {'body': 'Double Your Play Money!', 'video_hd_url': 'https://v/1.mp4'},
                {'body': 'Double Your Play Money!', 'original_image_url': 'https://i/2.jpg'},
            ]}}
        out = normalise(1, raw)
        self.assertEqual(out['body'], 'Double Your Play Money!')     # deduplicated
        self.assertEqual([m['type'] for m in out['media']], ['video', 'image'])

    def test_a_read_is_complete_only_when_it_matches_the_page(self):
        self.assertTrue(scraped(ad('1', 1), ad('2', 2)).complete)
        self.assertFalse(scraped(ad('1', 1), site_count=24).complete)     # half-loaded
        self.assertFalse(ScrapeResult(page_id=PAGE, ads=[], site_count=None).complete)
        self.assertTrue(ScrapeResult(page_id=PAGE, ads=[], site_count=0).complete)


class SyncTests(TestCase):
    def setUp(self):
        owner = User.objects.create_user(username='o', email='o@x.com', password='x')
        self.ws = Workspace.objects.create(name='WS', owner=owner)
        self.c = Competitor.objects.create(workspace=self.ws, page_id=PAGE)

    def sync(self, result):
        with mock.patch('apps.competitors.services.fetch_page_ads', return_value=result):
            return sync_competitor(self.c)

    def test_the_first_sync_stores_the_ads_in_impression_order(self):
        summary = self.sync(scraped(ad('1', 1), ad('2', 2)))
        self.assertEqual(summary['new'], 2)
        self.assertEqual(list(self.c.ads.order_by('position').values_list('ad_archive_id', flat=True)),
                         ['1', '2'])
        self.c.refresh_from_db()
        self.assertEqual(self.c.page_name, 'Topdog Games')
        self.assertIsNotNone(self.c.last_synced_at)
        self.assertGreater(self.c.next_sync_at, timezone.now() + timedelta(hours=23))

    def test_an_ad_gone_from_a_complete_read_has_ended(self):
        self.sync(scraped(ad('1', 1), ad('2', 2)))
        summary = self.sync(scraped(ad('1', 1)))
        self.assertEqual(summary['ended'], 1)
        gone = self.c.ads.get(ad_archive_id='2')
        self.assertFalse(gone.is_active)
        self.assertIsNotNone(gone.ended_at)
        self.assertIsNone(gone.position)
        self.assertTrue(self.c.ads.get(ad_archive_id='1').is_active)

    def test_a_partial_read_ends_nothing(self):
        self.sync(scraped(ad('1', 1), ad('2', 2), ad('3', 3)))
        # the page says 24, we got one: blocked or half-loaded, not 23 endings
        summary = self.sync(scraped(ad('1', 1), site_count=24))
        self.assertEqual(summary['ended'], 0)
        self.assertEqual(self.c.ads.filter(is_active=True).count(), 3)
        self.c.refresh_from_db()
        self.assertIn('Partial read', self.c.last_error)

    def test_a_failed_read_changes_no_ads_and_retries_sooner(self):
        self.sync(scraped(ad('1', 1)))
        with mock.patch('apps.competitors.services.fetch_page_ads', side_effect=ScrapeError('blocked')):
            summary = sync_competitor(self.c)
        self.assertFalse(summary['ok'])
        self.assertTrue(self.c.ads.get(ad_archive_id='1').is_active)
        self.c.refresh_from_db()
        self.assertEqual(self.c.last_error, 'blocked')
        self.assertLess(self.c.next_sync_at, timezone.now() + timedelta(hours=4))

    def test_an_ended_ad_that_comes_back_is_live_again(self):
        self.sync(scraped(ad('1', 1), ad('2', 2)))
        self.sync(scraped(ad('1', 1)))
        self.sync(scraped(ad('1', 1), ad('2', 2)))
        back = self.c.ads.get(ad_archive_id='2')
        self.assertTrue(back.is_active)
        self.assertIsNone(back.ended_at)

    def test_media_links_are_refreshed_every_sync(self):
        self.sync(scraped(ad('1', 1)))
        fresh = ad('1', 1)
        fresh['media'] = [{'type': 'video', 'url': 'https://video.fbcdn/1.mp4?oe=NEW'}]
        self.sync(scraped(fresh))
        self.assertTrue(self.c.ads.get().media[0]['url'].endswith('oe=NEW'))

    def test_days_running_counts_to_today_or_to_the_end(self):
        self.sync(scraped(ad('1', 1, started_days_ago=30), ad('2', 2, started_days_ago=40)))
        CompetitorAd.objects.filter(ad_archive_id='2').update(
            is_active=False, ended_at=timezone.now() - timedelta(days=35))
        self.assertEqual(self.c.ads.get(ad_archive_id='1').days_running, 30)
        self.assertEqual(self.c.ads.get(ad_archive_id='2').days_running, 5)


class SchedulerTests(TestCase):
    def setUp(self):
        owner = User.objects.create_user(username='s', email='s@x.com', password='x')
        self.ws = Workspace.objects.create(name='WS', owner=owner)

    def test_only_due_competitors_are_started(self):
        due = Competitor.objects.create(workspace=self.ws, page_id='111111',
                                        next_sync_at=timezone.now() - timedelta(minutes=1))
        Competitor.objects.create(workspace=self.ws, page_id='222222',
                                  next_sync_at=timezone.now() + timedelta(hours=5))
        with mock.patch('apps.competitors.services.sync_in_background') as run:
            sync_due_competitors()
        run.assert_called_once_with(due.pk)
        due.refresh_from_db()
        self.assertIsNone(due.next_sync_at)          # claimed

    def test_a_claim_can_only_be_won_once(self):
        c = Competitor.objects.create(workspace=self.ws, page_id='333333',
                                      next_sync_at=timezone.now() - timedelta(minutes=1))
        stale_copy = Competitor.objects.get(pk=c.pk)
        self.assertTrue(claim(c))
        self.assertFalse(claim(stale_copy))          # the other worker loses


class ApiTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='a', email='a@x.com', password='x')
        self.ws = Workspace.objects.create(name='WS', owner=self.owner)
        WorkspaceMember.objects.create(workspace=self.ws, user=self.owner, role='owner')
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def add(self, value, client=None):
        with mock.patch('apps.competitors.views.sync_in_background') as run:
            resp = (client or self.client).post('/api/competitors/', {'url': value}, format='json')
        return resp, run

    def test_adding_by_link_creates_and_syncs_straight_away(self):
        resp, run = self.add(f'https://www.facebook.com/ads/library/?view_all_page_id={PAGE}')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.json()['page_id'], PAGE)
        run.assert_called_once()

    def test_the_same_page_twice_is_refused(self):
        self.add(PAGE)
        resp, run = self.add(PAGE)
        self.assertEqual(resp.status_code, 400)
        run.assert_not_called()

    def test_junk_is_refused(self):
        resp, _ = self.add('topdog games')
        self.assertEqual(resp.status_code, 400)

    def test_analysts_cannot_add(self):
        analyst = User.objects.create_user(username='n', email='n@x.com', password='x')
        WorkspaceMember.objects.create(workspace=self.ws, user=analyst, role='analyst')
        c = APIClient()
        c.force_authenticate(user=analyst)
        with mock.patch('apps.competitors.views.sync_in_background'):
            resp = c.post('/api/competitors/', {'page_id': PAGE}, format='json',
                          HTTP_X_WORKSPACE_ID=str(self.ws.id))
        self.assertEqual(resp.status_code, 403)

    def test_a_workspace_follows_a_bounded_number(self):
        for i in range(MAX_COMPETITORS_PER_WORKSPACE):
            Competitor.objects.create(workspace=self.ws, page_id=str(100000 + i))
        resp, _ = self.add('999999999')
        self.assertEqual(resp.status_code, 400)

    def test_ads_are_scoped_to_the_workspace(self):
        mine = Competitor.objects.create(workspace=self.ws, page_id='111111')
        CompetitorAd.objects.create(competitor=mine, ad_archive_id='m1', start_date=date.today())
        other_owner = User.objects.create_user(username='z', email='z@x.com', password='x')
        other_ws = Workspace.objects.create(name='Other', owner=other_owner)
        theirs = Competitor.objects.create(workspace=other_ws, page_id='222222')
        CompetitorAd.objects.create(competitor=theirs, ad_archive_id='t1', start_date=date.today())
        ids = [a['ad_archive_id'] for a in self.client.get('/api/competitors/ads/').json()['results']]
        self.assertEqual(ids, ['m1'])

    def test_min_days_counts_how_long_it_actually_ran(self):
        c = Competitor.objects.create(workspace=self.ws, page_id='111111')
        today = date.today()
        CompetitorAd.objects.create(competitor=c, ad_archive_id='long', start_date=today - timedelta(days=45))
        # started 40 days ago but lasted five — not a long-runner
        CompetitorAd.objects.create(competitor=c, ad_archive_id='short', start_date=today - timedelta(days=40),
                                    is_active=False, ended_at=timezone.now() - timedelta(days=35))
        CompetitorAd.objects.create(competitor=c, ad_archive_id='new', start_date=today - timedelta(days=3))
        got = self.client.get('/api/competitors/ads/?min_days=30').json()['results']
        self.assertEqual([a['ad_archive_id'] for a in got], ['long'])
        ranked = self.client.get('/api/competitors/ads/?ordering=-days_running').json()['results']
        self.assertEqual([a['ad_archive_id'] for a in ranked], ['long', 'short', 'new'])

    def test_sync_now_is_rate_limited_and_never_doubled(self):
        c = Competitor.objects.create(workspace=self.ws, page_id='111111',
                                      next_sync_at=timezone.now() + timedelta(hours=10))
        with mock.patch('apps.competitors.views.sync_in_background') as run:
            first = self.client.post(f'/api/competitors/{c.pk}/sync/')
            again = self.client.post(f'/api/competitors/{c.pk}/sync/')      # still claimed
        self.assertEqual(first.status_code, 202)
        self.assertEqual(again.status_code, 409)
        run.assert_called_once()
        c.refresh_from_db()
        c.next_sync_at = timezone.now() + timedelta(hours=10)
        c.last_synced_at = timezone.now() - timedelta(minutes=2)
        c.save()
        with mock.patch('apps.competitors.views.sync_in_background'):
            too_soon = self.client.post(f'/api/competitors/{c.pk}/sync/')
        self.assertEqual(too_soon.status_code, 429)

    def test_list_reports_counts_and_whether_it_is_syncing(self):
        c = Competitor.objects.create(workspace=self.ws, page_id='111111', next_sync_at=None)
        CompetitorAd.objects.create(competitor=c, ad_archive_id='a', is_active=True)
        CompetitorAd.objects.create(competitor=c, ad_archive_id='b', is_active=False)
        row = self.client.get('/api/competitors/').json()[0]
        self.assertEqual((row['active_ads'], row['total_ads'], row['syncing']), (1, 2, True))


ANALYSIS = {
    'format': 'offer card', 'hook': 'A huge 100% match headline', 'angle': 'Double your first deposit',
    'offer': {'type': 'deposit match', 'text': '100% deposit match'}, 'emotion': 'greed',
    'audience': 'US sports fans', 'visual': {'composition': 'centered headline', 'subjects': 'coins',
    'colors': ['green', 'gold'], 'text_overlay': 'DOUBLE IT', 'style': '3D render'},
    'design': {'density': 'minimal', 'element_count': 4, 'typography': 'heavy condensed sans',
    'effects': 'none — flat fills', 'background': 'solid black', 'recipe': 'flat card'},
    'why_it_works': 'One clear number.', 'tags': ['offer', 'bold'], 'version': 2,
}
IDEA = {'theme': 'Hot Ticket', 'concept': 'An oversized headline card.', 'visual_direction': 'v',
        'extra_prompt': 'e', 'style_lock': 'Flat graphic design, solid purple, no glow', 'headline': 'CASHBACK',
        'promo_line': 'Up to 5% of your losses', 'insight': 'We took the giant 100% hook.'}


class AnalysisTests(TestCase):
    def setUp(self):
        owner = User.objects.create_user(username='an', email='an@x.com', password='x')
        self.ws = Workspace.objects.create(name='WS', owner=owner)
        self.c = Competitor.objects.create(workspace=self.ws, page_id=PAGE, page_name='Topdog Games')

    def make_ad(self, ad_id, media):
        return CompetitorAd.objects.create(competitor=self.c, ad_archive_id=ad_id, position=1,
                                           start_date=date.today() - timedelta(days=12), media=media)

    def analyse(self, ad, answer=ANALYSIS):
        from .analysis import analyze_ad
        with mock.patch('apps.competitors.analysis._rehost', side_effect=lambda u: f'hosted:{u}'), \
             mock.patch('apps.fingerprint.services._call_vision_api',
                        return_value=json.dumps(answer)) as vision:
            ok = analyze_ad(ad)
        ad.refresh_from_db()
        return ok, vision

    def test_an_image_ad_is_read_from_its_rehosted_images(self):
        ad = self.make_ad('1', [{'type': 'image', 'url': 'https://fb/a.jpg'},
                                {'type': 'video', 'url': 'https://fb/b.mp4'}])
        ok, vision = self.analyse(ad)
        self.assertTrue(ok)
        self.assertEqual(vision.call_args.args[0], ['hosted:https://fb/a.jpg'])   # images only
        self.assertEqual((ad.analysis_status, ad.analysis['hook']), ('done', 'A huge 100% match headline'))

    def test_a_video_only_ad_is_skipped_without_a_model_call(self):
        ad = self.make_ad('2', [{'type': 'video', 'url': 'https://fb/b.mp4'}])
        ok, vision = self.analyse(ad)
        self.assertFalse(ok)
        vision.assert_not_called()
        self.assertEqual(ad.analysis_status, 'skipped')

    def test_an_unusable_answer_is_a_failure_that_the_next_sync_retries(self):
        from .analysis import analyze_new_ads
        ad = self.make_ad('3', [{'type': 'image', 'url': 'https://fb/a.jpg'}])
        ok, _ = self.analyse(ad, answer={'nothing': 'useful'})
        self.assertFalse(ok)
        self.assertEqual(ad.analysis_status, 'failed')
        with mock.patch('apps.competitors.analysis.analyze_ad', return_value=True) as again:
            analyze_new_ads(self.c)
        again.assert_called_once()

    def test_the_sync_analyses_the_new_ads(self):
        with mock.patch('apps.competitors.services.fetch_page_ads', return_value=scraped(ad('1', 1))), \
             mock.patch('apps.competitors.services.analyze_new_ads', return_value=1) as analyse:
            summary = sync_competitor(self.c)
        analyse.assert_called_once_with(self.c)
        self.assertEqual(summary['analysed'], 1)

    def test_a_crashing_analysis_never_breaks_the_sync(self):
        with mock.patch('apps.competitors.services.fetch_page_ads', return_value=scraped(ad('1', 1))), \
             mock.patch('apps.competitors.services.analyze_new_ads', side_effect=RuntimeError('boom')):
            summary = sync_competitor(self.c)
        self.assertTrue(summary['ok'])
        self.c.refresh_from_db()
        self.assertIsNotNone(self.c.next_sync_at)       # not left claimed


class AdaptTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='ad', email='ad@x.com', password='x')
        self.ws = Workspace.objects.create(name='Spinpals', owner=self.owner)
        WorkspaceMember.objects.create(workspace=self.ws, user=self.owner, role='owner')
        self.c = Competitor.objects.create(workspace=self.ws, page_id=PAGE, page_name='Topdog Games')
        self.ad = CompetitorAd.objects.create(
            competitor=self.c, ad_archive_id='1', position=2, start_date=date.today() - timedelta(days=40),
            media=[{'type': 'image', 'url': 'https://fb/a.jpg'}], analysis=ANALYSIS, analysis_status='done')
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def adapt(self, ad=None, offers=('CASHBACK | Up to 5% of your losses',), client=None):
        with mock.patch('apps.creatives.services._load_promo_texts', return_value=list(offers)), \
             mock.patch('apps.fingerprint.services._call_text_api', return_value=json.dumps(IDEA)) as text:
            resp = (client or self.client).post(f'/api/competitors/ads/{(ad or self.ad).pk}/adapt/',
                                                HTTP_X_WORKSPACE_ID=str(self.ws.id))
        return resp, text

    def test_the_idea_is_shaped_like_a_trend_idea_and_names_its_source(self):
        resp, _ = self.adapt()
        self.assertEqual(resp.status_code, 200)
        idea = resp.json()
        for key in ('id', 'theme', 'concept', 'visual_direction', 'extra_prompt', 'insight'):
            self.assertIn(key, idea)
        self.assertEqual(idea['source']['competitor_ad_id'], self.ad.pk)
        self.assertEqual((idea['headline'], idea['style_lock']), ('CASHBACK', IDEA['style_lock']))

    def test_only_our_offers_reach_the_model(self):
        _, text = self.adapt()
        prompt = text.call_args.args[1]
        self.assertIn('CASHBACK | Up to 5% of your losses', prompt)
        self.assertNotIn('100% deposit match', prompt)          # the rival's offer stays out

    def test_with_no_offers_of_ours_the_model_is_told_to_make_none(self):
        _, text = self.adapt(offers=())
        self.assertIn('leave headline and promo_line empty', text.call_args_list[0].args[1])

    def test_an_unanalysed_ad_is_analysed_first(self):
        CompetitorAd.objects.filter(pk=self.ad.pk).update(analysis={}, analysis_status='')

        def analysed(ad):
            CompetitorAd.objects.filter(pk=ad.pk).update(analysis=ANALYSIS, analysis_status='done')
            return True
        with mock.patch('apps.competitors.views.analyze_ad', side_effect=analysed) as run:
            resp, _ = self.adapt()
        run.assert_called_once()
        self.assertEqual(resp.status_code, 200)

    def test_video_ads_are_refused(self):
        CompetitorAd.objects.filter(pk=self.ad.pk).update(analysis_status='skipped')
        resp, text = self.adapt()
        self.assertEqual(resp.status_code, 400)
        text.assert_not_called()

    def test_analysts_cannot_adapt(self):
        analyst = User.objects.create_user(username='an2', email='an2@x.com', password='x')
        WorkspaceMember.objects.create(workspace=self.ws, user=analyst, role='analyst')
        c = APIClient()
        c.force_authenticate(user=analyst)
        resp, text = self.adapt(client=c)
        self.assertEqual(resp.status_code, 403)
        text.assert_not_called()

    def test_another_workspaces_ad_is_not_found(self):
        other = User.objects.create_user(username='o2', email='o2@x.com', password='x')
        ows = Workspace.objects.create(name='Other', owner=other)
        theirs = CompetitorAd.objects.create(
            competitor=Competitor.objects.create(workspace=ows, page_id='222222'),
            ad_archive_id='t', analysis=ANALYSIS, analysis_status='done')
        resp, _ = self.adapt(ad=theirs)
        self.assertEqual(resp.status_code, 404)


class CopyGuardTests(TestCase):
    """The idea's copy is ours; the competitor's offer, figures and words never carry over."""
    OFFERS = ['3 SUPER HOT CHILLIES | HOLD AND WIN', 'JACKPOT WIN', 'GC 1200000']

    def setUp(self):
        owner = User.objects.create_user(username='cg', email='cg@x.com', password='x')
        ws = Workspace.objects.create(name='Spinpals', owner=owner)
        c = Competitor.objects.create(workspace=ws, page_id=PAGE, page_name='Topdog Games')
        self.ad = CompetitorAd.objects.create(
            competitor=c, ad_archive_id='1', title='Play for Cash', analysis={
                **ANALYSIS, 'offer': {'type': 'deposit match', 'text': '100% DEPOSIT $10 | GET $20!'},
                'visual': {'text_overlay': '100% DEPOSIT $10 | GET $20! CLAIM'}}, analysis_status='done')

    def idea(self, **over):
        from .analysis import AdaptedIdea
        clean = {'theme': 'Giant Chilli Card', 'concept': 'An oversized headline fills a flat card.',
                 'visual_direction': 'Solid purple, gold condensed type, emerald ticket, one button.',
                 'extra_prompt': 'Flat poster.', 'style_lock': 'Flat graphic design, no glow, no 3D',
                 'headline': '3 SUPER HOT CHILLIES', 'promo_line': 'HOLD AND WIN', 'insight': 'i'}
        return AdaptedIdea(**{**clean, **over})

    def check(self, idea, offers=None):
        from .analysis import check_idea
        return check_idea(idea, self.ad, self.OFFERS if offers is None else offers)

    def test_a_clean_idea_passes(self):
        self.assertEqual(self.check(self.idea()), [])
        self.assertEqual(self.check(self.idea(promo_line='GC 1200000')), [])

    def test_the_competitors_figures_are_caught_anywhere(self):
        self.assertTrue(self.check(self.idea(headline='100% MATCH')))
        self.assertTrue(self.check(self.idea(extra_prompt='A gold "$20" ticket.')))

    def test_offers_we_do_not_run_are_caught(self):
        self.assertTrue(self.check(self.idea(promo_line='Double Your First Deposit Today')))
        self.assertTrue(self.check(self.idea(concept='Our welcome bonus on a flat card.')))

    def test_copy_must_be_one_of_our_offers(self):
        self.assertTrue(self.check(self.idea(headline='SPIN TO WIN BIG')))

    def test_design_language_is_not_mistaken_for_an_offer(self):
        idea = self.idea(style_lock='Flat design to match the palette, 3 elements, reference layout')
        self.assertEqual(self.check(idea), [])

    def test_with_no_offers_there_is_no_copy(self):
        self.assertTrue(self.check(self.idea(), offers=[]))
        self.assertEqual(self.check(self.idea(headline='', promo_line=''), offers=[]), [])

    def adapt(self, *answers):
        from .analysis import adapt_ad
        with mock.patch('apps.creatives.services._load_promo_texts', return_value=self.OFFERS), \
             mock.patch('apps.fingerprint.services._call_text_api',
                        side_effect=[json.dumps(a) for a in answers]) as text:
            try:
                return adapt_ad(self.ad, self.ad.competitor.workspace), text
            except RuntimeError as exc:
                return exc, text

    def test_a_borrowing_answer_is_rewritten_once(self):
        bad = {**self.idea(headline='100% MATCH').model_dump()}
        good = self.idea().model_dump()
        idea, text = self.adapt(bad, good)
        self.assertEqual(idea['headline'], '3 SUPER HOT CHILLIES')
        self.assertEqual(text.call_count, 2)
        self.assertIn('100%', text.call_args.args[1])          # told what it got wrong

    def test_it_gives_up_rather_than_ship_their_copy(self):
        bad = self.idea(promo_line='Double Your First Deposit Today').model_dump()
        result, _ = self.adapt(bad, bad)
        self.assertIsInstance(result, RuntimeError)


class PromptArchitectSeedTests(TestCase):
    def setUp(self):
        owner = User.objects.create_user(username='pa', email='pa@x.com', password='x')
        self.ws = Workspace.objects.create(name='WS', owner=owner)

    def build(self, seed):
        from apps.fingerprint.services import build_master_prompt
        with mock.patch('apps.fingerprint.services._call_architect_api', return_value='prompt') as call:
            build_master_prompt(self.ws, seed)
        return call.call_args.args[1]

    def test_a_competitor_seed_carries_its_style_lock_and_exact_copy(self):
        sent = self.build({'theme': 't', 'concept': 'c', 'style_lock': 'Flat, no glow',
                           'headline': 'JACKPOT WIN', 'promo_line': ''})
        self.assertIn('REFERENCE STYLE LOCK:\nFlat, no glow', sent)
        self.assertIn('Headline: "JACKPOT WIN"', sent)

    def test_other_seeds_are_unchanged(self):
        sent = self.build({'theme': 't', 'concept': 'c'})
        self.assertNotIn('STYLE LOCK', sent)
        self.assertNotIn('EXACT ON-IMAGE COPY', sent)


class StaleAnalysisTests(TestCase):
    def test_reads_from_an_older_analysis_are_redone(self):
        from .analysis import analyze_new_ads
        owner = User.objects.create_user(username='st', email='st@x.com', password='x')
        c = Competitor.objects.create(workspace=Workspace.objects.create(name='W', owner=owner), page_id=PAGE)
        old = CompetitorAd.objects.create(competitor=c, ad_archive_id='old', analysis={'hook': 'h'},
                                          analysis_status='done')
        CompetitorAd.objects.create(competitor=c, ad_archive_id='new', analysis=ANALYSIS, analysis_status='done')
        with mock.patch('apps.competitors.analysis.analyze_ad', return_value=True) as run:
            analyze_new_ads(c)
        self.assertEqual([call.args[0].pk for call in run.call_args_list], [old.pk])
