"""
Schema migration: overhaul billing models.

Changes:
- Plan.tier: remove unique constraint
- Plan: add monthly_credits, trial_days, trial_credits, unlimited_usage
- Plan: make member_limit nullable (None = unlimited)
- Plan: remove credit_limit (replaced by monthly_credits — data copied first)
- Subscription: add monthly_usage, credit_bonus, trial_ends_at
- Subscription: remove credit_balance (replaced by monthly_usage + plan.monthly_credits)
"""
from django.db import migrations, models


def copy_credit_limit_to_monthly_credits(apps, schema_editor):
    Plan = apps.get_model('billing', 'Plan')
    for plan in Plan.objects.all():
        plan.monthly_credits = plan.credit_limit or 0
        plan.save(update_fields=['monthly_credits'])


def copy_credit_balance_to_bonus(apps, schema_editor):
    """
    For existing subscriptions, carry credit_balance over as credit_bonus so
    workspaces don't lose their manually-assigned balance overnight.
    monthly_usage starts at 0 (fresh month tracking begins now).
    """
    Subscription = apps.get_model('billing', 'Subscription')
    for sub in Subscription.objects.all():
        sub.credit_bonus   = sub.credit_balance or 0
        sub.monthly_usage  = 0
        sub.save(update_fields=['credit_bonus', 'monthly_usage'])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('billing', '0001_initial'),
    ]

    operations = [
        # ── Plan: add new fields (before removing old ones) ─────────────────
        migrations.AddField(
            model_name='plan',
            name='monthly_credits',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='plan',
            name='trial_days',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='plan',
            name='trial_credits',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='plan',
            name='unlimited_usage',
            field=models.BooleanField(default=False),
        ),
        # Copy credit_limit → monthly_credits
        migrations.RunPython(copy_credit_limit_to_monthly_credits, noop),
        # Remove unique from tier
        migrations.AlterField(
            model_name='plan',
            name='tier',
            field=models.CharField(
                choices=[
                    ('free',       'Free Trial'),
                    ('individual', 'Individual'),
                    ('team',       'Team'),
                    ('enterprise', 'Enterprise'),
                ],
                max_length=30,
            ),
        ),
        # Make member_limit nullable
        migrations.AlterField(
            model_name='plan',
            name='member_limit',
            field=models.IntegerField(blank=True, null=True, default=1),
        ),
        # Remove credit_limit (data already copied)
        migrations.RemoveField(
            model_name='plan',
            name='credit_limit',
        ),

        # ── Subscription: add new fields ─────────────────────────────────────
        migrations.AddField(
            model_name='subscription',
            name='monthly_usage',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='subscription',
            name='credit_bonus',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='subscription',
            name='trial_ends_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        # Copy credit_balance → credit_bonus, zero out monthly_usage
        migrations.RunPython(copy_credit_balance_to_bonus, noop),
        # Remove credit_balance (replaced by monthly_usage + credit_bonus)
        migrations.RemoveField(
            model_name='subscription',
            name='credit_balance',
        ),
    ]
