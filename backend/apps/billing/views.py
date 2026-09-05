from django.utils import timezone
from datetime import timedelta
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from apps.accounts.views import get_workspace, get_member_role
from .models import Plan, Subscription, CreditTransaction
from .serializers import PlanSerializer, SubscriptionSerializer, CreditsSerializer, CreditTransactionSerializer

_ADMIN_ROLES = {'owner', 'admin'}


class PlansView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        plans = Plan.objects.filter(is_active=True).exclude(tier='free').order_by('price_monthly')
        return Response(PlanSerializer(plans, many=True).data)


class SubscribeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ws = get_workspace(request)
        if not ws:
            return Response(status=404)
        # Only admins/owners may change the subscription plan
        if get_member_role(request.user, ws) not in _ADMIN_ROLES:
            return Response({'detail': 'Admin permission required.'}, status=403)
        plan_id = request.data.get('plan_id')
        try:
            plan = Plan.objects.get(id=plan_id)
        except Plan.DoesNotExist:
            return Response({'detail': 'Plan not found.'}, status=400)

        now = timezone.now()
        period_end = now + timedelta(days=30)

        sub, created = Subscription.objects.get_or_create(
            workspace=ws,
            defaults={
                'plan': plan,
                'status': 'active',
                'monthly_usage': 0,
                'credit_bonus': plan.trial_credits,
                'credit_used': 0,
                'current_period_start': now,
                'current_period_end': period_end,
            }
        )
        if not created:
            sub.plan = plan
            sub.status = 'active'
            sub.monthly_usage = 0
            sub.current_period_start = now
            sub.current_period_end = period_end
            sub.save(update_fields=['plan', 'status', 'monthly_usage',
                                    'current_period_start', 'current_period_end'])

        return Response(SubscriptionSerializer(sub).data)


class PlanView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        if not ws:
            return Response(status=404)
        try:
            sub = ws.subscription
        except Subscription.DoesNotExist:
            return Response(status=404)
        return Response(SubscriptionSerializer(sub).data)


class CreditsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        if not ws:
            return Response(status=404)
        try:
            sub = ws.subscription
        except Subscription.DoesNotExist:
            return Response({'balance': 0, 'used': 0, 'total': 0, 'plan': None, 'updated_at': None})
        return Response(CreditsSerializer(sub).data)


class TransactionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        if not ws:
            return Response(status=404)
        txns = CreditTransaction.objects.filter(workspace=ws)[:50]
        return Response(CreditTransactionSerializer(txns, many=True).data)
