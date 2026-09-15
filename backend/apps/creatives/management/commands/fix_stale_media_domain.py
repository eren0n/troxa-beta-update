"""
One-off data fix for a domain-migration leftover.

This box used to be publicly reachable as troxa.ai (before troxa.ai was
repointed to the separate live Docker deployment and this box became
test.troxa.ai instead). Every locally-stored media URL saved before that
split — canvas edits, uploads — still reads "https://troxa.ai/media/..."
even though those files only ever lived, and still live, in *this* box's
own media/ directory (served today at https://test.troxa.ai/media/...).

CreativeImageProxyView fetches these URLs server-side; when the upstream
fetch 404s (troxa.ai's media root is a *different* directory on the live
box that never had these files), it falls back to redirecting the client
straight to that same broken troxa.ai URL — the "image comes out broken"
symptom reported for older/canvas-edited creatives, especially ones further
down an infinite-scroll page (more of the collection = more chances of
hitting one of these).

Usage:
    python manage.py fix_stale_media_domain          # dry run, prints counts only
    python manage.py fix_stale_media_domain --apply   # actually rewrites

Safe to re-run: only ever touches the exact "https://troxa.ai/media/"
prefix, never the already-correct "https://test.troxa.ai/media/" one.
"""
from django.core.management.base import BaseCommand
from django.db.models import Value
from django.db.models.functions import Replace

from apps.creatives.models import GeneratedCreative, VideoJob
from apps.fingerprint.models import ImageAnalysisRecord

OLD = 'https://troxa.ai/media/'
NEW = 'https://test.troxa.ai/media/'

TARGETS = [
    (GeneratedCreative, 'image_url'),
    (GeneratedCreative, 'thumbnail_url'),
    (GeneratedCreative, 'logo_applied_url'),
    (VideoJob, 'source_image_url'),
    (ImageAnalysisRecord, 'image_url'),
]


class Command(BaseCommand):
    help = 'Rewrite stale https://troxa.ai/media/ URLs left over from before the test.troxa.ai domain split.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply', action='store_true',
            help='Actually perform the update (default is a dry run that only reports counts).',
        )

    def handle(self, *args, **options):
        apply = options['apply']
        total = 0
        for model, field in TARGETS:
            qs = model.objects.filter(**{f'{field}__startswith': OLD})
            count = qs.count()
            if count and apply:
                qs.update(**{field: Replace(field, Value(OLD), Value(NEW))})
            total += count
            verb = 'rewrote' if apply else 'would rewrite'
            self.stdout.write(f'{model.__name__}.{field}: {verb} {count} row(s)')

        if not apply:
            self.stdout.write(self.style.WARNING(
                f'\nDry run — {total} row(s) total would be updated. Re-run with --apply to write the changes.'
            ))
        else:
            self.stdout.write(self.style.SUCCESS(f'\nDone — {total} row(s) updated.'))
