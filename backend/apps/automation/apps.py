import os
import sys
import threading
import time

from django.apps import AppConfig


class AutomationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.automation'

    def ready(self):
        cmd = ' '.join(sys.argv)
        if any(c in cmd for c in ('migrate', 'makemigrations', 'shell', 'collectstatic', 'createsuperuser', 'test')):
            return
        if 'runserver' in sys.argv and os.environ.get('RUN_MAIN') != 'true':
            return
        _start_scheduler()


def _start_scheduler():
    t = threading.Thread(target=_loop, daemon=True, name='automation-scheduler')
    t.start()


def _loop():
    time.sleep(10)
    while True:
        try:
            _check_due()
        except Exception:
            pass
        try:
            _cleanup_stuck_jobs()
        except Exception:
            pass
        try:
            _poll_video_jobs()
        except Exception:
            pass
        time.sleep(30)


def _cleanup_stuck_jobs():
    from django.db import close_old_connections
    from django.utils import timezone, timedelta
    from datetime import timedelta as _td
    close_old_connections()

    cutoff = timezone.now() - _td(minutes=15)

    # Video jobs stuck in processing for >15 min → error
    from apps.creatives.models import VideoJob
    stuck_videos = VideoJob.objects.filter(status='processing', created_at__lt=cutoff)
    count = stuck_videos.update(
        status='error',
        error_message='Generation timed out — server may have restarted. Please retry.'
    )
    if count:
        import logging
        logging.getLogger(__name__).warning(f'Cleaned up {count} stuck video job(s)')

    # AutomationRun jobs stuck in running for >20 min → error
    cutoff_run = timezone.now() - _td(minutes=20)
    from apps.automation.models import AutomationRun
    stuck_runs = AutomationRun.objects.filter(status='running', started_at__lt=cutoff_run)
    stuck_runs.update(
        status='error',
        error_message='Run timed out — server may have restarted.',
        completed_at=timezone.now()
    )


def _poll_video_jobs():
    from django.db import close_old_connections
    from django.conf import settings
    import fal_client
    close_old_connections()

    from apps.creatives.models import VideoJob
    from apps.creatives.services import _video_poll_complete

    import os
    os.environ['FAL_KEY'] = settings.FAL_KEY

    pending = VideoJob.objects.filter(status='processing', fal_request_id__gt='')
    for vjob in pending:
        try:
            status = fal_client.status('fal-ai/kling-video/v3/pro/image-to-video', vjob.fal_request_id, with_logs=False)
            if isinstance(status, fal_client.Completed):
                result = fal_client.result('fal-ai/kling-video/v3/pro/image-to-video', vjob.fal_request_id)
                _video_poll_complete(vjob, result)
            elif isinstance(status, fal_client.InProgress) or isinstance(status, fal_client.Queued):
                pass  # still running, check next cycle
        except Exception as e:
            VideoJob.objects.filter(pk=vjob.pk).update(
                status='error',
                error_message=f'Poll error: {str(e)[:200]}',
                fal_request_id='',
            )


def _check_due():
    from django.db import close_old_connections
    from django.utils import timezone
    from .models import Automation, AutomationRun
    from .services import run_automation_async
    close_old_connections()

    now = timezone.now()
    due = Automation.objects.filter(trigger_type='scheduled', is_active=True, next_run_at__lte=now)
    for automation in due:
        if AutomationRun.objects.filter(automation=automation, status='running').exists():
            continue
        run_automation_async(automation.pk)
