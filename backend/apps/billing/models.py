from django.contrib.postgres.fields import ArrayField
from django.db import models
from apps.accounts.models import Workspace


class Plan(models.Model):
    TIER_CHOICES = [
        ('free',       'Free Trial'),
        ('individual', 'Individual'),
        ('team',       'Team'),
        ('enterprise', 'Enterprise'),
    ]

    name            = models.CharField(max_length=100)
    # tier is NOT unique — multiple team packages can share the same tier
    tier            = models.CharField(max_length=30, choices=TIER_CHOICES)
    monthly_credits = models.IntegerField(default=0)   # credits given at each billing cycle reset
    trial_days      = models.IntegerField(default=0)   # free-trial length (0 = no time limit)
    trial_credits   = models.IntegerField(default=0)   # one-time trial credit grant
    unlimited_usage = models.BooleanField(default=False)  # enterprise: skip credit deduction entirely
    # member_limit: None = unlimited
    member_limit    = models.IntegerField(null=True, blank=True, default=1)
    features        = ArrayField(models.CharField(max_length=100), default=list, blank=True)
    price_monthly   = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_active       = models.BooleanField(default=True)

    class Meta:
        indexes = [
            models.Index(fields=['tier']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return self.name


class Subscription(models.Model):
    STATUS_CHOICES = [
        ('trialing', 'Trialing'),
        ('active',   'Active'),
        ('canceled', 'Canceled'),
        ('past_due', 'Past Due'),
    ]

    workspace    = models.OneToOneField(Workspace, on_delete=models.CASCADE, related_name='subscription')
    plan         = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name='subscriptions')
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default='trialing')

    # ── Monthly usage tracking ──────────────────────────────────────────────
    # monthly_usage resets to 0 at the start of each billing period.
    # credit_bonus is RMGS-granted extra credits on top of plan.monthly_credits
    # (does NOT reset monthly — manually managed).
    # available = plan.monthly_credits + credit_bonus - monthly_usage
    monthly_usage  = models.IntegerField(default=0)
    credit_bonus   = models.IntegerField(default=0)

    # ── All-time counter (analytics only, never reset) ──────────────────────
    credit_used    = models.IntegerField(default=0)

    # ── Period / trial ──────────────────────────────────────────────────────
    trial_ends_at        = models.DateTimeField(null=True, blank=True)
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end   = models.DateTimeField(null=True, blank=True)
    external_id          = models.CharField(max_length=255, blank=True)
    canceled_at          = models.DateTimeField(null=True, blank=True)
    created_at           = models.DateTimeField(auto_now_add=True)
    updated_at           = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['current_period_end']),
        ]

    def __str__(self):
        return f'{self.workspace.name}: {self.plan.name} ({self.status})'

    @property
    def credits_available(self):
        """Credits remaining this month (∞ for unlimited_usage plans)."""
        if self.plan.unlimited_usage:
            return None  # unlimited
        return max(0, self.plan.monthly_credits + self.credit_bonus - self.monthly_usage)

    @property
    def credits_limit(self):
        """Total credit ceiling this month."""
        if self.plan.unlimited_usage:
            return None
        return self.plan.monthly_credits + self.credit_bonus


class CreditTransaction(models.Model):
    TYPE_CHOICES = [('credit', 'Credit'), ('debit', 'Debit')]

    workspace        = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='transactions')
    amount           = models.IntegerField()
    transaction_type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    description      = models.CharField(max_length=255, blank=True)
    reference_type   = models.CharField(max_length=50, blank=True)
    reference_id     = models.UUIDField(null=True, blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['workspace', 'created_at']),
        ]

    def __str__(self):
        return f'{self.transaction_type} {self.amount} — {self.workspace.name}'
