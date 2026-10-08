from django.test import TestCase

class WorkspaceRenameTests(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        from apps.accounts.models import User, Workspace, WorkspaceMember
        self.owner = User.objects.create_user(username='rn', email='rn@x.com', password='x')
        self.ws = Workspace.objects.create(name='NGBet', owner=self.owner)
        WorkspaceMember.objects.create(workspace=self.ws, user=self.owner, role='owner')
        self.editor = User.objects.create_user(username='re', email='re@x.com', password='x')
        WorkspaceMember.objects.create(workspace=self.ws, user=self.editor, role='editor')
        self.APIClient = APIClient

    def rename(self, name, user=None, ws=None):
        api = self.APIClient()
        api.force_authenticate(user=user or self.owner)
        return api.patch(f'/api/workspaces/{(ws or self.ws).id}/', {'name': name}, format='json')

    def test_an_owner_renames_it(self):
        resp = self.rename('  NGBet Nigeria  ')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['name'], 'NGBet Nigeria')
        self.ws.refresh_from_db()
        self.assertEqual(self.ws.name, 'NGBet Nigeria')

    def test_an_editor_cannot(self):
        self.assertEqual(self.rename('Mine now', user=self.editor).status_code, 403)

    def test_empty_or_too_long_names_are_refused(self):
        self.assertEqual(self.rename('   ').status_code, 400)
        self.assertEqual(self.rename('x' * 101).status_code, 400)

    def test_someone_elses_workspace_is_not_found(self):
        from apps.accounts.models import User, Workspace
        other = User.objects.create_user(username='ro', email='ro@x.com', password='x')
        theirs = Workspace.objects.create(name='Theirs', owner=other)
        self.assertEqual(self.rename('Hijacked', ws=theirs).status_code, 404)
