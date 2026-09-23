from datetime import timedelta
from unittest import mock

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User, Workspace, WorkspaceMember
from .models import WorkspaceTrendBrief

URL = '/api/fingerprint/trends/'


class TrendScoutTriggerTests(TestCase):
    """
    Scouting trends is a paid web-search run, so it happens when someone asks
    for it and not because a page was opened.
    """

    def setUp(self):
        self.user = User.objects.create_user(username='t', email='t@u.com', password='x')
        self.ws = Workspace.objects.create(name='WS', owner=self.user)
        WorkspaceMember.objects.create(workspace=self.ws, user=self.user, role='owner')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def brief(self, *, status='ready', age_hours=1, ideas=None):
        b = WorkspaceTrendBrief.objects.create(
            workspace=self.ws, status=status, ideas=ideas or [{'id': 'i1', 'theme': 'x'}])
        # created_at is auto_now_add, so age has to be written after the insert
        WorkspaceTrendBrief.objects.filter(pk=b.pk).update(
            created_at=timezone.now() - timedelta(hours=age_hours))
        b.refresh_from_db()
        return b

    # ── GET is read-only ───────────────────────────────────────────────────
    def test_get_with_nothing_scouted_does_not_start_a_run(self):
        with mock.patch('apps.fingerprint.views.trigger_trend_scout') as run:
            r = self.client.get(URL)
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.json()['status'])
        self.assertEqual(r.json()['ideas'], [])
        run.assert_not_called()
        self.assertFalse(WorkspaceTrendBrief.objects.exists())

    def test_get_with_a_day_old_brief_does_not_start_a_run(self):
        b = self.brief(age_hours=25)
        with mock.patch('apps.fingerprint.views.trigger_trend_scout') as run:
            r = self.client.get(URL)
        run.assert_not_called()
        body = r.json()
        self.assertEqual(body['id'], b.id)
        self.assertTrue(body['stale'])          # the UI says so; it doesn't act on it
        self.assertEqual(WorkspaceTrendBrief.objects.count(), 1)

    def test_get_returns_a_fresh_brief_unchanged(self):
        self.brief(age_hours=2, ideas=[{'id': 'i1'}, {'id': 'i2'}])
        with mock.patch('apps.fingerprint.views.trigger_trend_scout') as run:
            body = self.client.get(URL).json()
        run.assert_not_called()
        self.assertEqual(len(body['ideas']), 2)
        self.assertFalse(body['stale'])

    def test_repeated_gets_never_accumulate_runs(self):
        with mock.patch('apps.fingerprint.views.trigger_trend_scout') as run:
            for _ in range(5):
                self.client.get(URL)
        run.assert_not_called()
        self.assertFalse(WorkspaceTrendBrief.objects.exists())

    # ── POST is the only trigger ───────────────────────────────────────────
    def test_post_starts_a_run(self):
        with mock.patch('apps.fingerprint.services._trend_scout_worker'):
            r = self.client.post(URL)
        self.assertEqual(r.status_code, 202)
        self.assertEqual(WorkspaceTrendBrief.objects.count(), 1)
        self.assertEqual(WorkspaceTrendBrief.objects.get().status, 'pending')

    def test_post_while_one_is_running_does_not_start_a_second(self):
        self.brief(status='pending')
        with mock.patch('apps.fingerprint.views.trigger_trend_scout') as run:
            r = self.client.post(URL)
        self.assertEqual(r.json()['status'], 'already_running')
        run.assert_not_called()
        self.assertEqual(WorkspaceTrendBrief.objects.count(), 1)

    def test_analysts_cannot_spend_a_run(self):
        analyst = User.objects.create_user(username='a', email='a@u.com', password='x')
        WorkspaceMember.objects.create(workspace=self.ws, user=analyst, role='analyst')
        client = APIClient()
        client.force_authenticate(user=analyst)
        with mock.patch('apps.fingerprint.views.trigger_trend_scout') as run:
            r = client.post(URL, HTTP_X_WORKSPACE_ID=str(self.ws.id))
        self.assertEqual(r.status_code, 403)
        run.assert_not_called()
