import io
import threading

from django.utils import timezone


def run_automation_async(automation_id):
    from .models import AutomationRun
    run = AutomationRun.objects.create(automation_id=automation_id)
    t = threading.Thread(target=_worker, args=(run.pk,), daemon=True)
    t.start()
    return run.pk


def _worker(run_id):
    from django.db import close_old_connections
    from .models import AutomationRun, Automation
    from apps.creatives.models import GenerationJob
    from apps.creatives.services import _generate_worker
    close_old_connections()

    try:
        run = AutomationRun.objects.select_related('automation__workspace').get(pk=run_id)
        automation = run.automation
        ws = automation.workspace

        # Determine which ratios to generate
        ratios_to_run = automation.aspect_ratios if automation.aspect_ratios else [automation.aspect_ratio]

        # Credit check before running (total images = per-ratio × num_ratios)
        from apps.billing.models import Subscription
        try:
            sub = ws.subscription
            if not sub.plan.unlimited_usage:
                available = sub.credits_available
                required = automation.num_images * len(ratios_to_run)
                if available < required:
                    raise Exception(f'Insufficient credits ({available} available, {required} required)')
        except Subscription.DoesNotExist:
            raise Exception('No active subscription found')

        # Notify Slack: automation started
        try:
            from apps.slack_integration.services import notify_slack_automation_start
            notify_slack_automation_start(ws, automation)
        except Exception:
            pass

        ref_creatives = list(automation.reference_creatives.all())
        all_jobs = []

        for ratio in ratios_to_run:
            job = GenerationJob.objects.create(
                workspace=ws,
                created_by=automation.created_by,
                generation_mode=automation.generation_mode,
                model_name=automation.model_name,
                aspect_ratio=ratio,
                resolution=automation.resolution,
                image_size=automation.image_size,
                image_quality=automation.image_quality,
                num_images=automation.num_images,
                output_format=automation.output_format,
                style=getattr(automation, 'style', '') or '',
                extra_prompt=automation.extra_prompt,
                use_fingerprint=automation.use_fingerprint,
                blend_weight=automation.blend_weight,
                simplicity_weight=automation.simplicity_weight,
                campaign=automation.campaign,
                character=automation.character,
            )
            job.reference_creatives.set(ref_creatives)

            if not all_jobs:
                # First job — link to run for backward-compat display
                run.generation_job = job
                run.save(update_fields=['generation_job'])

            _generate_worker(job.pk)
            job.refresh_from_db()

            if job.status == 'error':
                raise Exception(f'[{ratio}] {job.error_message or "Generation failed"}')

            all_jobs.append(job)

        if automation.logo:
            for j in all_jobs:
                try:
                    _auto_place_logo(run, j)
                except Exception:
                    pass

        run.status = 'done'
        run.completed_at = timezone.now()

        # Notify Slack: done with images (logo URLs preferred, fallback to raw)
        try:
            from apps.slack_integration.services import notify_slack_automation_done
            image_urls = []
            for j in all_jobs:
                j.refresh_from_db()
                image_urls.extend(
                    c.logo_applied_url or c.image_url
                    for c in j.creatives.all()
                    if c.logo_applied_url or c.image_url
                )
            notify_slack_automation_done(ws, automation, image_urls)
        except Exception:
            pass

        automation.last_run_at = timezone.now()
        if automation.trigger_type == 'scheduled':
            automation.next_run_at = _calculate_next_run(automation)
        automation.save(update_fields=['last_run_at', 'next_run_at'])

    except Exception as e:
        try:
            run.status = 'error'
            run.error_message = str(e)[:500]
            run.completed_at = timezone.now()
        except Exception:
            pass
        # Notify Slack: error
        try:
            from apps.slack_integration.services import notify_slack_automation_error
            notify_slack_automation_error(ws, automation, str(e)[:300])
        except Exception:
            pass

    try:
        run.save(update_fields=['status', 'completed_at', 'error_message'])
    except Exception:
        pass


def _auto_place_logo(run, job):
    from PIL import Image as PILImage
    from django.core.files.base import ContentFile
    from django.conf import settings
    from apps.creatives.models import LogoJob, LogoJobImage
    from apps.creatives.services import _find_best_logo_position, composite_logos_manual, _fetch_bytes

    automation = run.automation
    logo_path = automation.logo.file.path

    logo_job = LogoJob.objects.create(
        workspace=automation.workspace,
        created_by=automation.created_by,
        source_job=job,
    )
    run.logo_job = logo_job
    run.save(update_fields=['logo_job'])

    logo_pil = PILImage.open(logo_path).convert('RGBA')
    alpha = logo_pil.split()[-1]
    bbox = alpha.getbbox()
    trimmed = logo_pil.crop(bbox) if bbox else logo_pil

    site_base = getattr(settings, 'SITE_BASE_URL', 'http://localhost:8000').rstrip('/')
    saved_count = 0

    for creative in job.creatives.all():
        try:
            tw, th = trimmed.size
            img_bytes = _fetch_bytes(creative.image_url)
            base_img = PILImage.open(io.BytesIO(img_bytes))
            iw, ih = base_img.size

            max_w = int(iw * 0.24)
            max_h = int(ih * 0.20)
            scale = min(max_w / tw, max_h / th, 1.0)
            logo_w = max(1, int(tw * scale))
            logo_h = max(1, int(th * scale))

            x, y, _ = _find_best_logo_position(img_bytes, logo_w, logo_h)

            result = composite_logos_manual(creative.image_url, [{
                'logo_path': logo_path,
                'x': x, 'y': y,
                'logo_w': logo_w, 'logo_h': logo_h,
                'angle_deg': 0, 'opacity': 1.0,
            }])

            buf = io.BytesIO()
            result.save(buf, format='PNG')
            buf.seek(0)

            lji = LogoJobImage(job=logo_job, source_creative=creative)
            lji.file.save(f'auto_logo_{logo_job.pk}_{creative.pk}.png', ContentFile(buf.read()), save=True)

            creative.logo_applied_url = site_base + lji.file.url
            creative.save(update_fields=['logo_applied_url'])
            saved_count += 1
        except Exception:
            continue

    logo_job.status = 'done' if saved_count > 0 else 'error'
    logo_job.save(update_fields=['status'])


def _calculate_next_run(automation):
    import datetime as _dt
    from datetime import datetime, timedelta as _td
    try:
        from zoneinfo import ZoneInfo
    except ImportError:
        from backports.zoneinfo import ZoneInfo

    schedule_time = automation.schedule_time
    if not schedule_time:
        return None
    if isinstance(schedule_time, str):
        try:
            schedule_time = _dt.time.fromisoformat(schedule_time)
        except ValueError:
            return None

    tz_name = getattr(automation, 'schedule_timezone', None) or 'UTC'
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo('UTC')

    now_utc = timezone.now()
    now_local = now_utc.astimezone(tz)

    for delta in range(0, 9):
        candidate_date = (now_local + _td(days=delta)).date()
        naive_dt = datetime.combine(candidate_date, schedule_time)
        candidate_local = naive_dt.replace(tzinfo=tz)

        if candidate_local <= now_local:
            continue

        if automation.schedule_days:
            if candidate_date.weekday() not in automation.schedule_days:
                continue

        return candidate_local.astimezone(ZoneInfo('UTC'))

    return None
