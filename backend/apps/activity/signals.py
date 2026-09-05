import uuid as _uuid

from django.db.models.signals import post_save
from django.db.backends.signals import connection_created
from django.dispatch import receiver


def _s(v):
    """Convert UUID to str so metadata JSONField can serialize it."""
    return str(v) if isinstance(v, _uuid.UUID) else v


@receiver(connection_created)
def set_sqlite_wal(sender, connection, **kwargs):
    if connection.vendor == 'sqlite':
        cursor = connection.cursor()
        cursor.execute('PRAGMA journal_mode=WAL;')
        cursor.execute('PRAGMA synchronous=NORMAL;')
        cursor.execute('PRAGMA busy_timeout=30000;')


def log_event(workspace, event_type, description, user=None, metadata=None):
    from .models import ActivityEvent
    try:
        ActivityEvent.objects.create(
            workspace=workspace,
            user=user,
            event_type=event_type,
            description=description,
            metadata=metadata or {},
        )
    except Exception:
        pass


# ── Team ──────────────────────────────────────────────────────────────────────
# Note: creatives, brand_kit, and invite/member signals removed — views already
# call log_event directly, so signals were creating duplicate entries.


# ── Automation ────────────────────────────────────────────────────────────────

@receiver(post_save, sender='automation.Automation')
def on_automation_saved(sender, instance, created, **kwargs):
    ws = getattr(instance, 'workspace', None)
    if not ws:
        return
    user = getattr(instance, 'created_by', None)
    log_event(
        workspace=ws,
        event_type='automation.created' if created else 'automation.updated',
        description=f'{"Created" if created else "Updated"} pipeline "{instance.name}"',
        user=user,
        metadata={'automation_id': _s(instance.id)},
    )
