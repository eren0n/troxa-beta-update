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
