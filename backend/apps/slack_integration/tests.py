import hashlib
import hmac
import json
import time
from unittest import mock

from django.test import TestCase, override_settings

from apps.accounts.models import User, Workspace, WorkspaceMember
from apps.activity.models import ActivityEvent
from apps.creatives.models import GeneratedCreative
from apps.creatives.rating import WINNER_TAG_NAME, apply_rating, toggle_winner
from .models import SlackChannel, SlackInstallation
from .services import (
    RATE_ACTION_ID, WINNER_ACTION_ID, creative_action_blocks, refresh_rating_row,
)

SECRET = 'test-signing-secret'
URL = '/api/slack/interactions/'


class SyncThread:
    """
    Stand-in for threading.Thread that runs the target inline.

    The view hands the message rewrite to a daemon thread so Slack gets its ack
    inside 3 seconds; in a test that means the assertion races the thread, and a
    real thread would also get its own DB connection that can't see the test
    transaction's rows. Running it inline exercises the same code, in order.
    """

    def __init__(self, target=None, args=(), kwargs=None, daemon=None):
        self._call = lambda: target(*args, **(kwargs or {}))

    def start(self):
        self._call()


def sign(body, secret=SECRET, ts=None):
    ts = ts or str(int(time.time()))
    mac = hmac.new(secret.encode(), f'v0:{ts}:{body}'.encode(), hashlib.sha256)
    return {'HTTP_X_SLACK_REQUEST_TIMESTAMP': ts, 'HTTP_X_SLACK_SIGNATURE': 'v0=' + mac.hexdigest()}


@override_settings(SLACK_SIGNING_SECRET=SECRET)
class SlackRatingTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='a', email='a@b.com', password='x')
        self.ws = Workspace.objects.create(name='WS', owner=self.user)
        WorkspaceMember.objects.create(workspace=self.ws, user=self.user, role='owner')
        self.inst = SlackInstallation.objects.create(team_id='T1', bot_token='xoxb-1')
        self.chan = SlackChannel.objects.create(
            workspace=self.ws, installation=self.inst, channel_id='C1',
            content_types=['creatives'], auto_post_types=['creatives'],
        )
        self.creative = GeneratedCreative.objects.create(
            workspace=self.ws, name='Shot 1', image_url='https://cdn/x.png',
        )

    def post_action(self, action_id, value, channel='C1', team='T1', selected=True):
        action = {'action_id': action_id}
        if selected:
            action['selected_option'] = {'value': value}
        else:
            action['value'] = value
        payload = {
            'type': 'block_actions',
            'team': {'id': team},
            'channel': {'id': channel},
            'user': {'id': 'U9', 'username': 'eren'},
            'response_url': 'https://hooks.slack/x',
            'message': {'text': 'post', 'blocks': [
                {'type': 'image', 'image_url': 'https://cdn/x.png', 'fallback': '500x500',
                 'image_width': 500, 'image_height': 500, 'image_bytes': 1234},
                {'type': 'actions', 'block_id': f'rate:{self.creative.id}', 'elements': []},
            ]},
            'actions': [action],
        }
        body = 'payload=' + json.dumps(payload).replace('&', '%26')
        return self.client.post(URL, data=body,
                                content_type='application/x-www-form-urlencoded',
                                **sign(body))

    # ── the rating row itself ──────────────────────────────────────────────
    def test_blocks_carry_creative_id_and_full_scale(self):
        blocks = creative_action_blocks(self.creative)
        select = blocks[0]['elements'][0]
        self.assertEqual(blocks[0]['block_id'], f'rate:{self.creative.id}')
        self.assertEqual(len(select['options']), 10)
        self.assertEqual(select['options'][7]['value'], f'{self.creative.id}:8')
        self.assertNotIn('initial_option', select)
        self.assertEqual(blocks[0]['elements'][1]['action_id'], WINNER_ACTION_ID)
        self.assertEqual(len(blocks), 1)  # no status line while unrated

    def test_blocks_preselect_existing_rating_and_show_status(self):
        self.creative.rating = 8
        self.creative.save()
        blocks = creative_action_blocks(self.creative, actor='@eren')
        self.assertEqual(blocks[0]['elements'][0]['initial_option']['value'], f'{self.creative.id}:8')
        self.assertIn('8/10', blocks[1]['elements'][0]['text'])
        self.assertIn('@eren', blocks[1]['elements'][0]['text'])

    # ── shared rating path ─────────────────────────────────────────────────
    def test_apply_rating_clamps_triggers_fingerprint_and_logs(self):
        with mock.patch('apps.fingerprint.services.trigger_analyze_generation') as trig:
            self.assertTrue(apply_rating(self.creative, 99, source='slack', actor='@eren'))
        trig.assert_called_once_with(self.creative.id, self.ws.id)
        self.creative.refresh_from_db()
        self.assertEqual(self.creative.rating, 10)
        ev = ActivityEvent.objects.get(event_type='creative.rated')
        self.assertEqual(ev.metadata['source'], 'slack')
        self.assertEqual(ev.metadata['actor'], '@eren')

    def test_apply_rating_is_a_noop_when_unchanged(self):
        self.creative.rating = 5
        self.creative.save()
        with mock.patch('apps.fingerprint.services.trigger_analyze_generation') as trig:
            self.assertFalse(apply_rating(self.creative, 5))
        trig.assert_not_called()

    def test_toggle_winner_round_trips_the_shared_tag(self):
        self.assertTrue(toggle_winner(self.creative, source='slack', actor='@eren'))
        self.assertTrue(self.creative.tags.filter(name=WINNER_TAG_NAME).exists())
        self.assertFalse(toggle_winner(self.creative))
        self.assertFalse(self.creative.tags.filter(name=WINNER_TAG_NAME).exists())

    # ── endpoint ───────────────────────────────────────────────────────────
    def test_rating_from_slack_applies(self):
        with mock.patch('apps.fingerprint.services.trigger_analyze_generation'), \
             mock.patch('apps.slack_integration.views.threading.Thread', SyncThread), \
             mock.patch('apps.slack_integration.services.http_requests.post') as post:
            resp = self.post_action(RATE_ACTION_ID, f'{self.creative.id}:7')
        self.assertEqual(resp.status_code, 200)
        self.creative.refresh_from_db()
        self.assertEqual(self.creative.rating, 7)
        # the message got rewritten, with Slack's echo-only image fields stripped
        sent = post.call_args.kwargs['json']
        self.assertTrue(sent['replace_original'])
        image = sent['blocks'][0]
        self.assertNotIn('image_bytes', image)
        self.assertNotIn('fallback', image)
        self.assertIn('7/10', sent['blocks'][2]['elements'][0]['text'])

    def test_winner_button_from_slack_applies(self):
        with mock.patch('apps.slack_integration.services.http_requests.post'):
            resp = self.post_action(WINNER_ACTION_ID, str(self.creative.id), selected=False)
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(self.creative.tags.filter(name=WINNER_TAG_NAME).exists())

    def test_bad_signature_is_rejected(self):
        body = 'payload=' + json.dumps({'type': 'block_actions'})
        resp = self.client.post(URL, data=body, content_type='application/x-www-form-urlencoded',
                                **sign(body, secret='wrong'))
        self.assertEqual(resp.status_code, 403)

    def test_stale_timestamp_is_rejected(self):
        body = 'payload=' + json.dumps({'type': 'block_actions'})
        old = str(int(time.time()) - 6000)
        resp = self.client.post(URL, data=body, content_type='application/x-www-form-urlencoded',
                                **sign(body, ts=old))
        self.assertEqual(resp.status_code, 403)

    def test_channel_cannot_rate_another_workspaces_creative(self):
        other_user = User.objects.create_user(username='c', email='c@d.com', password='x')
        other_ws = Workspace.objects.create(name='Other', owner=other_user)
        foreign = GeneratedCreative.objects.create(
            workspace=other_ws, name='Theirs', image_url='https://cdn/y.png',
        )
        with mock.patch('apps.slack_integration.services.http_requests.post') as post:
            resp = self.post_action(RATE_ACTION_ID, f'{foreign.id}:9')
        self.assertEqual(resp.status_code, 200)
        foreign.refresh_from_db()
        self.assertIsNone(foreign.rating)
        post.assert_not_called()

    def test_unknown_channel_is_ignored(self):
        resp = self.post_action(RATE_ACTION_ID, f'{self.creative.id}:9', channel='C-NOPE')
        self.assertEqual(resp.status_code, 200)
        self.creative.refresh_from_db()
        self.assertIsNone(self.creative.rating)

    def test_junk_creative_id_does_not_error(self):
        resp = self.post_action(RATE_ACTION_ID, 'not-a-uuid:9')
        self.assertEqual(resp.status_code, 200)

    def test_unrelated_action_is_ignored(self):
        resp = self.post_action('some_other_button', str(self.creative.id), selected=False)
        self.assertEqual(resp.status_code, 200)

    # ── message rewrite leaves sibling variants alone ──────────────────────
    def test_rewrite_only_touches_its_own_row(self):
        other = GeneratedCreative.objects.create(
            workspace=self.ws, name='Shot 2', image_url='https://cdn/z.png',
        )
        self.creative.rating = 4
        self.creative.save()
        message = {'text': 'post', 'blocks': [
            {'type': 'actions', 'block_id': f'rate:{self.creative.id}', 'elements': []},
            {'type': 'context', 'block_id': f'rated:{self.creative.id}', 'elements': []},
            {'type': 'actions', 'block_id': f'rate:{other.id}', 'elements': ['KEEP']},
        ]}
        with mock.patch('apps.slack_integration.services.http_requests.post') as post:
            refresh_rating_row('https://hooks.slack/x', message, self.creative, actor='@eren')
        blocks = post.call_args.kwargs['json']['blocks']
        self.assertEqual(blocks[-1]['elements'], ['KEEP'])
        self.assertEqual(blocks[0]['block_id'], f'rate:{self.creative.id}')
        self.assertIn('4/10', blocks[1]['elements'][0]['text'])
        self.assertEqual(len(blocks), 3)   # no duplicate status line


@override_settings(SLACK_SIGNING_SECRET=SECRET)
class SlackGenerateTests(TestCase):
    """/troxa generate: opening the dialog, and what submitting it builds."""

    CMD_URL = '/api/slack/commands/'

    def setUp(self):
        from apps.billing.models import Plan, Subscription
        from apps.brand_kit.models import Campaign

        self.user = User.objects.create_user(username='g', email='g@h.com', password='x')
        self.ws = Workspace.objects.create(name='WS', owner=self.user)
        WorkspaceMember.objects.create(workspace=self.ws, user=self.user, role='owner')
        self.plan = Plan.objects.create(name='Team', tier='team', monthly_credits=100)
        Subscription.objects.create(workspace=self.ws, plan=self.plan)
        self.inst = SlackInstallation.objects.create(team_id='T1', bot_token='xoxb-1')
        self.chan = SlackChannel.objects.create(
            workspace=self.ws, installation=self.inst, channel_id='C1',
            # deliberately empty: a requested generation must report back here
            # regardless of what this channel auto-posts.
            content_types=[], auto_post_types=[],
        )
        self.campaign = Campaign.objects.create(workspace=self.ws, name='Summer Push')

    # ── /troxa generate ────────────────────────────────────────────────────
    def command(self, text='generate', channel='C1', team='T1'):
        body = (f'team_id={team}&channel_id={channel}&user_id=U9&user_name=eren'
                f'&trigger_id=TRIG&text={text}')
        return self.client.post(self.CMD_URL, data=body,
                                content_type='application/x-www-form-urlencoded',
                                **sign(body))

    def test_generate_opens_a_modal_for_a_connected_channel(self):
        with mock.patch('apps.slack_integration.views._post_slack',
                        return_value={'ok': True}) as api:
            resp = self.command()
        self.assertEqual(resp.status_code, 200)
        method, sent = api.call_args.args[1], api.call_args.args[2]
        self.assertEqual(method, 'views.open')
        self.assertEqual(sent['trigger_id'], 'TRIG')
        view = sent['view']
        self.assertEqual(view['private_metadata'], 'C1')          # where results go back
        blocks = {b.get('block_id'): b for b in view['blocks'] if b.get('block_id')}
        self.assertEqual(
            blocks['campaign']['element']['options'][0]['value'], str(self.campaign.id))
        self.assertTrue(blocks['campaign']['dispatch_action'])   # drives the brief list
        self.assertEqual(len(blocks['count']['element']['options']), 4)

    def test_generate_in_an_unconnected_channel_explains_setup(self):
        with mock.patch('apps.slack_integration.views._post_slack') as api:
            resp = self.command(channel='C-NOPE')
        self.assertIn('troxa setup', resp.json()['text'])
        api.assert_not_called()

    def test_generate_without_a_campaign_says_so(self):
        self.campaign.delete()
        with mock.patch('apps.slack_integration.views._post_slack') as api:
            resp = self.command()
        self.assertIn('no campaigns', resp.json()['text'])
        api.assert_not_called()

    # ── modal submission ───────────────────────────────────────────────────
    def submit(self, campaign_id=None, prompt='beach scene, 200% bonus', count='2',
               callback='troxa_generate', channel='C1'):
        payload = {
            'type': 'view_submission',
            'team': {'id': 'T1'},
            'user': {'id': 'U9', 'username': 'eren'},
            'view': {
                'callback_id': callback,
                'private_metadata': channel,
                'state': {'values': {
                    'campaign': {'campaign_pick': {'selected_option': {
                        'value': str(campaign_id or self.campaign.id)}}},
                    'prompt': {'prompt_text': {'value': prompt}},
                    'count': {'count_pick': {'selected_option': {'value': count}}},
                }},
            },
        }
        body = 'payload=' + json.dumps(payload)
        return self.client.post(URL, data=body,
                                content_type='application/x-www-form-urlencoded',
                                **sign(body))

    def test_submission_queues_a_job_attributed_to_slack(self):
        from apps.creatives.models import GenerationJob
        from apps.creatives.generation import AUTO_MODE_MODEL
        with mock.patch('apps.creatives.services.generate_job_async') as run, \
             mock.patch('apps.slack_integration.services._post'):
            resp = self.submit(count='3')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.content, b'')          # empty body closes the modal
        job = GenerationJob.objects.get()
        self.assertEqual(job.origin, 'slack')
        self.assertEqual(job.origin_channel, 'C1')   # results go back here
        self.assertIsNone(job.created_by)            # no slack-to-troxa mapping
        self.assertEqual(job.num_images, 3)
        self.assertEqual(job.extra_prompt, 'beach scene, 200% bonus')
        self.assertEqual(job.campaign, self.campaign)
        self.assertEqual(job.model_name, AUTO_MODE_MODEL)
        self.assertEqual(job.generation_mode, 'auto')
        # The brand fingerprint is hard-on for the Generate tab, so a Slack
        # request has to carry it too — without it the images come back generic
        # rather than on-brand, which is the whole point of the workspace's DNA.
        self.assertTrue(job.use_fingerprint)
        self.assertEqual(job.blend_weight, 50)
        run.assert_called_once_with(job.id)

    def test_insufficient_credits_keeps_the_modal_open(self):
        from apps.creatives.models import GenerationJob
        self.plan.monthly_credits = 2      # 3 images x 2 credits = 6 needed
        self.plan.save()
        with mock.patch('apps.creatives.services.generate_job_async') as run:
            resp = self.submit(count='3')
        body = resp.json()
        self.assertEqual(body['response_action'], 'errors')
        self.assertIn('count', body['errors'])
        self.assertFalse(GenerationJob.objects.exists())
        run.assert_not_called()

    def test_unlimited_plan_skips_the_credit_check(self):
        from apps.creatives.models import GenerationJob
        self.plan.monthly_credits = 0
        self.plan.unlimited_usage = True
        self.plan.save()
        with mock.patch('apps.creatives.services.generate_job_async'), \
             mock.patch('apps.slack_integration.services._post'):
            self.submit(count='4')
        self.assertEqual(GenerationJob.objects.count(), 1)

    def test_blank_prompt_is_rejected(self):
        from apps.creatives.models import GenerationJob
        resp = self.submit(prompt='   ')
        self.assertEqual(resp.json()['errors']['prompt'],
                         'Say what the creative should show.')
        self.assertFalse(GenerationJob.objects.exists())

    def test_campaign_from_another_workspace_is_rejected(self):
        from apps.brand_kit.models import Campaign
        from apps.creatives.models import GenerationJob
        other_owner = User.objects.create_user(username='o', email='o@p.com', password='x')
        other_ws = Workspace.objects.create(name='Other', owner=other_owner)
        foreign = Campaign.objects.create(workspace=other_ws, name='Theirs')
        resp = self.submit(campaign_id=foreign.id)
        self.assertIn('campaign', resp.json()['errors'])
        self.assertFalse(GenerationJob.objects.exists())

    def test_submission_from_an_unknown_channel_is_rejected(self):
        from apps.creatives.models import GenerationJob
        resp = self.submit(channel='C-NOPE')
        self.assertEqual(resp.json()['response_action'], 'errors')
        self.assertFalse(GenerationJob.objects.exists())

    def test_unrelated_modal_is_ignored(self):
        resp = self.submit(callback='some_other_modal')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.content, b'')

    # ── results going back ─────────────────────────────────────────────────
    def test_results_post_back_to_the_requesting_channel_with_rating_rows(self):
        from apps.creatives.models import GeneratedCreative, GenerationJob
        from apps.slack_integration.services import post_generation_result
        job = GenerationJob.objects.create(
            workspace=self.ws, campaign=self.campaign, origin='slack',
            origin_channel='C1', num_images=1, model_name='GPT Image 2')
        c = GeneratedCreative.objects.create(
            workspace=self.ws, job=job, name='Shot', image_url='https://cdn/a.png')
        with mock.patch('apps.slack_integration.services._post') as api:
            post_generation_result(job, [c])
        sent = api.call_args.args[2]
        self.assertEqual(sent['channel'], 'C1')
        ids = [b.get('block_id') for b in sent['blocks']]
        self.assertIn(f'rate:{c.id}', ids)           # rateable straight away
        c.refresh_from_db()
        self.assertTrue(c.tags.filter(name='Slack Posted').exists())

    def test_gallery_credits_slack_for_the_generation(self):
        from apps.creatives.models import GeneratedCreative, GenerationJob
        from apps.creatives.serializers import GeneratedCreativeSerializer
        job = GenerationJob.objects.create(workspace=self.ws, origin='slack', origin_channel='C1')
        c = GeneratedCreative.objects.create(
            workspace=self.ws, job=job, name='Shot', image_url='https://cdn/a.png')
        data = GeneratedCreativeSerializer(c).data
        self.assertEqual(data['created_by_name'], 'Slack')
        self.assertEqual(data['generated_by_name'], 'Slack')


@override_settings(SLACK_SIGNING_SECRET=SECRET)
class SlackGenerateBriefTests(TestCase):
    """The dialog's Campaign Intel brief picker — the same mechanism the Generate tab uses."""

    def setUp(self):
        from apps.billing.models import Plan, Subscription
        from apps.brand_kit.models import Campaign
        from apps.fingerprint.models import CampaignCreativeBrief

        self.user = User.objects.create_user(username='b', email='b@c.com', password='x')
        self.ws = Workspace.objects.create(name='WS', owner=self.user)
        WorkspaceMember.objects.create(workspace=self.ws, user=self.user, role='owner')
        plan = Plan.objects.create(name='Team', tier='team', monthly_credits=500)
        Subscription.objects.create(workspace=self.ws, plan=plan)
        self.inst = SlackInstallation.objects.create(team_id='T1', bot_token='xoxb-1')
        self.chan = SlackChannel.objects.create(
            workspace=self.ws, installation=self.inst, channel_id='C1',
            content_types=[], auto_post_types=[])
        self.campaign = Campaign.objects.create(workspace=self.ws, name='Summer Push')
        self.other_campaign = Campaign.objects.create(workspace=self.ws, name='Winter')
        CampaignCreativeBrief.objects.create(
            campaign=self.campaign, workspace=self.ws, status='ready',
            briefs=[
                {'id': 'brief_1', 'type': 'on-brand', 'title': 'Zeus Enthroned',
                 'extra_prompt': 'A muscular Zeus hurling lightning at the logo'},
                {'id': 'brief_2', 'type': 'trend-forward', 'title': 'Neon Reels',
                 'extra_prompt': 'Neon-lit slot reels spinning over a city skyline'},
                # no extra_prompt — nothing to put in the prompt box, so it is skipped
                {'id': 'brief_3', 'type': 'the-bet', 'title': 'Half-written'},
            ])

    def change(self, action_id, values, view_id='V1'):
        payload = {
            'type': 'block_actions',
            'team': {'id': 'T1'},
            'user': {'id': 'U9', 'username': 'eren'},
            'actions': [{'action_id': action_id}],
            'view': {
                'id': view_id, 'hash': 'H1',
                'callback_id': 'troxa_generate', 'private_metadata': 'C1',
                'state': {'values': values},
            },
        }
        body = 'payload=' + json.dumps(payload)
        with mock.patch('apps.slack_integration.views._post_slack',
                        return_value={'ok': True}) as api:
            resp = self.client.post(URL, data=body,
                                    content_type='application/x-www-form-urlencoded',
                                    **sign(body))
        return resp, api

    def state(self, campaign=None, brief='', prompt='', count='2'):
        values = {
            'campaign': {'campaign_pick': {'selected_option': {
                'value': str(campaign.id) if campaign else ''}}},
            'prompt': {'prompt_text': {'value': prompt}},
            'count': {'count_pick': {'selected_option': {'value': count}}},
        }
        if brief:
            values['brief'] = {'brief_pick': {'selected_option': {'value': brief}}}
        return values

    def blocks_of(self, api):
        view = api.call_args.args[2]['view']
        return {b.get('block_id'): b for b in view['blocks'] if b.get('block_id')}, view

    def test_picking_a_campaign_loads_its_briefs(self):
        resp, api = self.change('campaign_pick', self.state(campaign=self.campaign))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(api.call_args.args[1], 'views.update')
        self.assertEqual(api.call_args.args[2]['view_id'], 'V1')
        blocks, _ = self.blocks_of(api)
        options = blocks['brief']['element']['options']
        self.assertEqual([o['value'] for o in options], ['brief_1', 'brief_2'])
        self.assertIn('Zeus Enthroned', options[0]['text']['text'])
        self.assertIn('On Brand', options[0]['text']['text'])
        self.assertTrue(blocks['brief']['optional'])

    def test_picking_a_brief_fills_the_prompt_like_the_generate_tab(self):
        _, api = self.change('brief_pick',
                             self.state(campaign=self.campaign, brief='brief_2', prompt='typed'))
        blocks, _ = self.blocks_of(api)
        self.assertEqual(blocks['prompt']['element']['initial_value'],
                         'Neon-lit slot reels spinning over a city skyline')
        self.assertEqual(blocks['brief']['element']['initial_option']['value'], 'brief_2')

    def test_changing_the_campaign_drops_the_previous_brief(self):
        _, api = self.change('campaign_pick',
                             self.state(campaign=self.other_campaign, brief='brief_1',
                                        prompt='keep me'))
        blocks, view = self.blocks_of(api)
        self.assertNotIn('brief', blocks)                     # Winter has no briefs
        # the hint is a context block, which carries no block_id
        self.assertIn('No Campaign Intel briefs', json.dumps(view))
        # whatever was typed survives the re-render
        self.assertEqual(blocks['prompt']['element']['initial_value'], 'keep me')

    def test_selection_and_count_survive_a_rerender(self):
        _, api = self.change('campaign_pick', self.state(campaign=self.campaign, count='4'))
        blocks, _ = self.blocks_of(api)
        self.assertEqual(blocks['campaign']['element']['initial_option']['value'],
                         str(self.campaign.id))
        self.assertEqual(blocks['count']['element']['initial_option']['value'], '4')

    def test_only_the_newest_ready_brief_set_is_offered(self):
        from apps.fingerprint.models import CampaignCreativeBrief
        from apps.slack_integration.services import briefs_for_campaign
        CampaignCreativeBrief.objects.create(
            campaign=self.campaign, workspace=self.ws, status='ready',
            briefs=[{'id': 'brief_9', 'type': 'the-bet', 'title': 'Newest',
                     'extra_prompt': 'newer direction'}])
        CampaignCreativeBrief.objects.create(
            campaign=self.campaign, workspace=self.ws, status='pending',
            briefs=[{'id': 'brief_x', 'extra_prompt': 'not ready'}])
        self.assertEqual([b['id'] for b in briefs_for_campaign(self.campaign)], ['brief_9'])

    def test_a_dialog_change_from_another_modal_is_ignored(self):
        payload = {
            'type': 'block_actions', 'team': {'id': 'T1'}, 'user': {'id': 'U9'},
            'actions': [{'action_id': 'campaign_pick'}],
            'view': {'id': 'V1', 'callback_id': 'someone_elses_modal',
                     'private_metadata': 'C1', 'state': {'values': {}}},
        }
        body = 'payload=' + json.dumps(payload)
        with mock.patch('apps.slack_integration.views._post_slack') as api:
            resp = self.client.post(URL, data=body,
                                    content_type='application/x-www-form-urlencoded',
                                    **sign(body))
        self.assertEqual(resp.status_code, 200)
        api.assert_not_called()

    def test_submitting_a_brief_filled_prompt_generates_from_it(self):
        from apps.creatives.models import GenerationJob
        payload = {
            'type': 'view_submission', 'team': {'id': 'T1'},
            'user': {'id': 'U9', 'username': 'eren'},
            'view': {'callback_id': 'troxa_generate', 'private_metadata': 'C1',
                     'state': {'values': self.state(
                         campaign=self.campaign, brief='brief_1',
                         prompt='A muscular Zeus hurling lightning at the logo')}},
        }
        body = 'payload=' + json.dumps(payload)
        with mock.patch('apps.creatives.services.generate_job_async'), \
             mock.patch('apps.slack_integration.services._post'):
            resp = self.client.post(URL, data=body,
                                    content_type='application/x-www-form-urlencoded',
                                    **sign(body))
        self.assertEqual(resp.status_code, 200)
        job = GenerationJob.objects.get()
        self.assertEqual(job.extra_prompt, 'A muscular Zeus hurling lightning at the logo')
        self.assertTrue(job.use_fingerprint)
