from rest_framework import serializers
from .models import Plan, Subscription, CreditTransaction


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = ('id', 'name', 'tier', 'monthly_credits', 'trial_days', 'trial_credits',
                  'unlimited_usage', 'member_limit', 'features', 'price_monthly')


class SubscriptionSerializer(serializers.ModelSerializer):
    plan            = PlanSerializer(read_only=True)
    available       = serializers.SerializerMethodField()
    credits_limit   = serializers.SerializerMethodField()

    class Meta:
        model  = Subscription
        fields = ('id', 'plan', 'status', 'monthly_usage', 'credit_bonus', 'credit_used',
                  'available', 'credits_limit', 'trial_ends_at',
                  'current_period_start', 'current_period_end')

    def get_available(self, obj):
        return obj.credits_available   # None = unlimited

    def get_credits_limit(self, obj):
        return obj.credits_limit       # None = unlimited


class CreditsSerializer(serializers.ModelSerializer):
    """Lightweight credits summary used by /api/billing/credits/."""
    balance  = serializers.SerializerMethodField()
    used     = serializers.IntegerField(source='credit_used')
    total    = serializers.SerializerMethodField()
    plan     = serializers.CharField(source='plan.name', read_only=True)
    # seats the plan allows; None = unlimited
    member_limit = serializers.IntegerField(source='plan.member_limit', read_only=True, allow_null=True)

    class Meta:
        model  = Subscription
        fields = ('balance', 'used', 'total', 'plan', 'member_limit', 'updated_at')

    def get_balance(self, obj):
        return obj.credits_available   # None = unlimited

    def get_total(self, obj):
        return obj.credits_limit       # None = unlimited


class CreditTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CreditTransaction
        fields = ('id', 'amount', 'transaction_type', 'description', 'reference_type', 'created_at')
