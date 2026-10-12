"""
Put back the statics that Make Video turned into videos.

Until the gallery gave videos their own creative, a finished video was shown
by rewriting its source static into a video (media_type and name), so the
static disappeared from the gallery. For each creative that went through
that, this adds the static back as its own creative next to the video. The
video creative is left as it is — ratings, tags and Slack posts made on it
stay with the video.

Safe to run twice: a static already restored (a photo with the same image in
the same workspace) is not added again.

    python manage.py restore_video_statics --dry-run
    python manage.py restore_video_statics
"""
import re
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.creatives.models import GeneratedCreative


def static_name(video_name):
    return re.sub(r'_V_', '_S_', video_name or '', count=1)


class Command(BaseCommand):
    help = 'Restore the statics that Make Video converted into videos.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Show what would be restored, change nothing.')

    def handle(self, *args, dry_run=False, **options):
        # Converted rows: a "Video" creative that is itself a video job's
        # source. Uploaded videos never had a video job; new videos made after
        # the fix are not any job's source until someone makes a video of them.
        converted = (GeneratedCreative.objects
                     .filter(media_type='Video', video_jobs__isnull=False)
                     .distinct().select_related('workspace'))
        restored = skipped = 0
        for video in converted:
            already = GeneratedCreative.objects.filter(
                workspace=video.workspace, media_type='Photo', image_url=video.image_url).exists()
            if already:
                skipped += 1
                continue
            self.stdout.write(f'{video.workspace.name}: {video.name} -> {static_name(video.name)}')
            if dry_run:
                restored += 1
                continue
            with transaction.atomic():
                static = GeneratedCreative.objects.create(
                    workspace=video.workspace, job=video.job, campaign=video.campaign,
                    name=static_name(video.name), image_url=video.image_url,
                    thumbnail_url=video.thumbnail_url, media_type='Photo',
                    aspect_ratio=video.aspect_ratio, source=video.source,
                    created_by=video.created_by, uploaded_by=video.uploaded_by,
                    is_edited=video.is_edited, caption=video.caption, caption_status='done',
                )
                # Sit where the static was in the timeline, just before its video.
                GeneratedCreative.objects.filter(pk=static.pk).update(
                    created_at=video.created_at - timedelta(seconds=1))
            restored += 1
        verb = 'Would restore' if dry_run else 'Restored'
        self.stdout.write(self.style.SUCCESS(f'{verb} {restored} static(s); {skipped} already present.'))
