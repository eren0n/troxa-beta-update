from unittest import mock

from django.core.signing import Signer
from django.test import TestCase

from apps.accounts.models import User
from .models import DriveConnection

URL = '/api/drive/oauth/callback/'


def google(token_ok=True, refresh='refresh-1', email='someone@rmgs.online'):
    """Stand-ins for Google's token exchange and userinfo responses."""
    token = mock.Mock()
    token.json.return_value = (
        {'access_token': 'access-1', 'refresh_token': refresh, 'expires_in': 3600}
        if token_ok else {'error': 'invalid_grant'}
    )
    info = mock.Mock()
    info.json.return_value = {'email': email}
    return token, info


class DriveOAuthCallbackTests(TestCase):
    """
    Every new Drive connection 500'd: the callback wrote generations_folder_id,
    a field migration 0003 removed when it moved to root_folder_id.
    """

    def setUp(self):
        self.user = User.objects.create_user(username='d', email='d@e.com', password='x')

    def callback(self, *, state=None, **google_kwargs):
        token, info = google(**google_kwargs)
        with mock.patch('apps.drive_integration.views.http_requests.post', return_value=token), \
             mock.patch('apps.drive_integration.views.http_requests.get', return_value=info):
            return self.client.get(URL, {
                'code': 'auth-code',
                'state': state if state is not None else Signer().sign(str(self.user.id)),
            })

    def test_a_first_connection_is_created_instead_of_500ing(self):
        resp = self.callback()
        self.assertEqual(resp.status_code, 302)
        self.assertIn('drive=connected', resp['Location'])
        conn = DriveConnection.objects.get(user=self.user)
        self.assertEqual(conn.drive_email, 'someone@rmgs.online')
        self.assertEqual(conn.access_token, 'access-1')
        self.assertEqual(conn.refresh_token, 'refresh-1')

    def test_reconnecting_clears_the_old_accounts_folder(self):
        DriveConnection.objects.create(
            user=self.user, drive_email='old@rmgs.online', access_token='a',
            refresh_token='r', root_folder_id='folder-in-the-old-drive')
        self.callback(email='new@rmgs.online')
        conn = DriveConnection.objects.get(user=self.user)
        self.assertEqual(conn.drive_email, 'new@rmgs.online')
        self.assertEqual(conn.root_folder_id, '')          # found or made again next sync
        self.assertEqual(DriveConnection.objects.filter(user=self.user).count(), 1)

    def test_a_forged_state_is_refused(self):
        resp = self.callback(state='9:not-a-real-signature')
        self.assertEqual(resp.status_code, 302)
        self.assertNotIn('drive=connected', resp['Location'])
        self.assertFalse(DriveConnection.objects.exists())

    def test_google_saying_no_is_not_a_500(self):
        resp = self.client.get(URL, {'error': 'access_denied'})
        self.assertEqual(resp.status_code, 302)
        self.assertFalse(DriveConnection.objects.exists())
