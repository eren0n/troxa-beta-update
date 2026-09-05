"""
Data migration: set up canonical plans and migrate existing subscriptions.

Before:
  Plan 1  tier=free        → name='Free Trial'    (10 cr)
  Plan 2  tier=enterprise  → name='RMGS Team'     (5000 cr)

After:
  Plan 1  tier=free        → Free Trial   (50 cr/mo, 14-day trial, no premium features)
  Plan 3  tier=individual  → Individual   (100 cr/mo, 1 member, no premium features)
  Plan 4  tier=team        → Team         (1000 cr/mo, 10 members, all features)
  Plan 2  tier=enterprise  → Enterprise   (unlimited, null members, all features)

Workspace migrations:
  current free        → individual plan
  current enterprise  → team plan
"""
from django.db import migrations

ALL_FEATURES = ['fingerprint', 'campaign_intel', 'prompt_studio', 'slack', 'meta']


def setup_plans(apps, schema_editor):
    Plan         = apps.get_model('billing', 'Plan')
    Subscription = apps.get_model('billing', 'Subscription')

    # ── Update existing Free Trial plan ─────────────────────────────────────
    free_plan = Plan.objects.get(tier='free')
    free_plan.name           = 'Free Trial'
    free_plan.monthly_credits = 50
    free_plan.trial_days      = 14
    free_plan.trial_credits   = 50
    free_plan.unlimited_usage = False
    free_plan.member_limit    = 1
    free_plan.features        = []
    free_plan.price_monthly   = 0
    free_plan.save()

    # ── Update existing Enterprise plan → keep as Enterprise (bypass) ────────
    ent_plan = Plan.objects.get(tier='enterprise')
    ent_plan.name            = 'Enterprise'
    ent_plan.monthly_credits = 0
    ent_plan.unlimited_usage = True
    ent_plan.member_limit    = None   # unlimited
    ent_plan.features        = ALL_FEATURES
    ent_plan.price_monthly   = 0
    ent_plan.save()

    # ── Create Individual plan ───────────────────────────────────────────────
    ind_plan, _ = Plan.objects.get_or_create(
        tier='individual',
        defaults=dict(
            name            = 'Individual',
            monthly_credits = 100,
            trial_days      = 0,
            trial_credits   = 0,
            unlimited_usage = False,
            member_limit    = 1,
            features        = [],
            price_monthly   = 1,
            is_active       = True,
        ),
    )

    # ── Create Team plan ─────────────────────────────────────────────────────
    team_plan, _ = Plan.objects.get_or_create(
        tier='team',
        defaults=dict(
            name            = 'Team',
            monthly_credits = 1000,
            trial_days      = 0,
            trial_credits   = 0,
            unlimited_usage = False,
            member_limit    = 10,
            features        = ALL_FEATURES,
            price_monthly   = 1,
            is_active       = True,
        ),
    )

    # ── Migrate existing subscriptions ───────────────────────────────────────
    # free  → individual
    Subscription.objects.filter(plan=free_plan).update(plan=ind_plan)

    # enterprise → team
    Subscription.objects.filter(plan=ent_plan).update(plan=team_plan)


def rollback(apps, schema_editor):
    # Non-destructive rollback: just reset names/flags — data is already migrated.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('billing', '0002_billing_overhaul'),
    ]

    operations = [
        migrations.RunPython(setup_plans, rollback),
    ]
