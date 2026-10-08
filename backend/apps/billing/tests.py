from django.test import TestCase

class CreditsSeatLimitTests(TestCase):
    def test_credits_carry_the_plans_seat_limit(self):
        from rest_framework.test import APIClient
        from apps.accounts.models import User, Workspace, WorkspaceMember
        from apps.billing.models import Plan, Subscription
        user = User.objects.create_user(username='sl', email='sl@x.com', password='x')
        ws = Workspace.objects.create(name='NG', owner=user)
        WorkspaceMember.objects.create(workspace=ws, user=user, role='owner')
        plan = Plan.objects.create(name='Enterprise', tier='enterprise', monthly_credits=100, member_limit=20)
        Subscription.objects.create(workspace=ws, plan=plan)
        api = APIClient(); api.force_authenticate(user=user)
        get = lambda: api.get('/api/billing/credits/', HTTP_X_WORKSPACE_ID=str(ws.id)).json()
        self.assertEqual(get()['member_limit'], 20)
        plan.member_limit = None; plan.save()
        self.assertIsNone(get()['member_limit'])     # unlimited
