import io
from unittest import mock

from django.test import TestCase
from PIL import Image

from apps.accounts.models import User, Workspace, WorkspaceMember
from apps.creatives.models import GeneratedCreative
from apps.creatives.views import _AI_EDIT_RATIOS, _keep_source_ratio, _ratio_value


def png(width, height):
    buf = io.BytesIO()
    Image.new('RGB', (width, height), 'white').save(buf, format='PNG')
    return buf.getvalue()


class KeepSourceRatioTests(TestCase):
    """
    "Keep the current size" has to name a ratio the edit model understands.
    Passing 'auto' let nano-banana answer 928x1152 regardless, which turned
    9:16 stories into something close to 4:5.
    """

    def setUp(self):
        self.user = User.objects.create_user(username='r', email='r@s.com', password='x')
        self.ws = Workspace.objects.create(name='WS', owner=self.user)
        WorkspaceMember.objects.create(workspace=self.ws, user=self.user, role='owner')
        self.creative = GeneratedCreative.objects.create(
            workspace=self.ws, name='Shot', image_url='https://cdn/a.png', aspect_ratio='9:16')

    def ratio_for(self, width, height):
        with mock.patch('apps.creatives.views._fetch_bytes', return_value=png(width, height)):
            return _keep_source_ratio(self.creative, 'https://cdn/a.png')

    # ── the sizes these models actually return ─────────────────────────────
    def test_gpt_image_2_portrait_is_recognised_as_9_16(self):
        self.assertEqual(self.ratio_for(1024, 1792), '9:16')     # 0.571

    def test_nano_banana_portrait_is_recognised_as_9_16(self):
        self.assertEqual(self.ratio_for(768, 1376), '9:16')      # 0.558

    def test_the_edit_models_own_default_reads_as_4_5(self):
        # what a 'auto' edit came back as, whatever it was given
        self.assertEqual(self.ratio_for(928, 1152), '4:5')       # 0.806

    def test_square_stays_square(self):
        self.assertEqual(self.ratio_for(1024, 1024), '1:1')

    def test_landscape_is_recognised(self):
        self.assertEqual(self.ratio_for(1792, 1024), '16:9')

    def test_exact_story_size_is_9_16(self):
        self.assertEqual(self.ratio_for(1080, 1920), '9:16')

    # ── fallbacks ──────────────────────────────────────────────────────────
    def test_it_never_returns_a_ratio_the_model_would_reject(self):
        # 15:17 is a label the gallery can store; the model would not take it
        for size in [(1024, 1160), (900, 1000), (1234, 987), (500, 501)]:
            self.assertIn(self.ratio_for(*size), _AI_EDIT_RATIOS)

    def test_an_unreadable_source_falls_back_to_the_stored_label(self):
        with mock.patch('apps.creatives.views._fetch_bytes', side_effect=OSError('boom')):
            self.assertEqual(_keep_source_ratio(self.creative, 'https://cdn/a.png'), '9:16')

    def test_an_unusable_stored_label_falls_back_to_auto(self):
        self.creative.aspect_ratio = '15:17'      # not something the model takes
        with mock.patch('apps.creatives.views._fetch_bytes', side_effect=OSError('boom')):
            self.assertEqual(_keep_source_ratio(self.creative, 'https://cdn/a.png'), 'auto')

    def test_ratio_values_are_what_they_claim(self):
        self.assertAlmostEqual(_ratio_value('9:16'), 0.5625)
        self.assertAlmostEqual(_ratio_value('1:1'), 1.0)


class AiEditSendsARatioTests(TestCase):
    """What actually reaches fal when someone edits without changing the size."""

    def setUp(self):
        from apps.billing.models import Plan, Subscription
        from rest_framework.test import APIClient
        self.user = User.objects.create_user(username='e', email='e@f.com', password='x')
        self.ws = Workspace.objects.create(name='WS', owner=self.user)
        WorkspaceMember.objects.create(workspace=self.ws, user=self.user, role='owner')
        Subscription.objects.create(
            workspace=self.ws, plan=Plan.objects.create(name='T', tier='team', monthly_credits=100))
        self.creative = GeneratedCreative.objects.create(
            workspace=self.ws, name='Story', image_url='https://cdn/a.png', aspect_ratio='9:16')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def edit(self, ratio):
        """Run an edit and return the arguments handed to the model."""
        with mock.patch('apps.creatives.views._fetch_bytes', return_value=png(1024, 1792)), \
             mock.patch('apps.creatives.views._subscribe_with_retry',
                        return_value={'images': [{'url': 'https://cdn/out.png'}]}) as sub:
            self.client.post(f'/api/creatives/{self.creative.id}/ai-edit/',
                             {'prompt': 'make it pop', 'aspect_ratio': ratio}, format='json')
        return sub.call_args.args[1] if sub.call_args else None

    def test_current_size_sends_the_sources_real_ratio(self):
        args = self.edit('Current Size')
        self.assertEqual(args['aspect_ratio'], '9:16')      # not 'auto'

    def test_a_missing_ratio_is_treated_the_same_way(self):
        args = self.edit('something the UI never sends')
        self.assertEqual(args['aspect_ratio'], '9:16')

    def test_an_explicit_choice_is_passed_through_untouched(self):
        self.assertEqual(self.edit('1:1 — Square')['aspect_ratio'], '1:1')
        self.assertEqual(self.edit('16:9 — Landscape')['aspect_ratio'], '16:9')

    def test_auto_never_reaches_the_model_when_the_source_can_be_read(self):
        for ratio in ('Current Size', '', 'auto'):
            self.assertNotEqual(self.edit(ratio)['aspect_ratio'], 'auto')
