def log_event(workspace, user, event_type, description, metadata=None):
    try:
        from .models import ActivityEvent
        ActivityEvent.objects.create(
            workspace=workspace,
            user=user,
            event_type=event_type,
            description=description,
            metadata=metadata or {},
        )
    except Exception:
        pass
