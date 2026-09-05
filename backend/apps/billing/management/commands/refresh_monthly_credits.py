"""
Management command: refresh_monthly_credits
============================================

Resets monthly_usage to 0 for all active subscriptions at the start of
a new billing period. Run this on the 1st of each month via cron:

    0 0 1 * * /home/ubuntu/troxa-beta/backend/venv/bin/python \
              /home/ubuntu/troxa-beta/backend/manage.py refresh_monthly_credits

Usage
-----
  python manage.py refresh_monthly_credits          # reset all active subs
  python manage.py refresh_monthly_credits --dry-run
  python manage.py refresh_monthly_credits epicsweep  # single workspace
"""

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone


class Command(BaseCommand):
    help = 'Reset monthly_usage to 0 for all active (non-enterprise) subscriptions.'

    def add_arguments(self, parser):
        parser.add_argument(
            'workspace', nargs='?', metavar='WORKSPACE_NAME',
            help='Optional: reset only this workspace (case-insensitive substring).',
        )
        parser.add_argument('--dry-run', action='store_true', dest='dry_run')

    def handle(self, *args, **options):
        from apps.billing.models import Subscription
        from apps.accounts.models import Workspace

        dry_run = options['dry_run']
        ws_filter = options.get('workspace')

        qs = Subscription.objects.select_related('workspace', 'plan').filter(
            status__in=('active', 'trialing'),
            plan__unlimited_usage=False,
        )

        if ws_filter:
            ws_ids = Workspace.objects.filter(name__icontains=ws_filter).values_list('id', flat=True)
            if not ws_ids:
                raise CommandError(f'No workspace matching {ws_filter!r}')
            qs = qs.filter(workspace_id__in=ws_ids)

        now = timezone.now()
        count = 0
        for sub in qs:
            self.stdout.write(
                f'  {"[DRY] " if dry_run else ""}Reset {sub.workspace.name!r}: '
                f'monthly_usage {sub.monthly_usage} → 0  '
                f'(plan={sub.plan.name}, monthly_credits={sub.plan.monthly_credits})'
            )
            if not dry_run:
                sub.monthly_usage          = 0
                sub.current_period_start   = now
                sub.save(update_fields=['monthly_usage', 'current_period_start'])
            count += 1

        self.stdout.write(self.style.SUCCESS(
            f'\n{"[DRY RUN] " if dry_run else ""}Reset {count} subscription(s).'
        ))
