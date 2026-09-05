from django.conf import settings
from django.db import migrations


def forwards(apps, schema_editor):
    WinningStatic = apps.get_model('brand_kit', 'WinningStatic')
    GeneratedCreative = apps.get_model('creatives', 'GeneratedCreative')
    GenerationJob = apps.get_model('creatives', 'GenerationJob')

    base_url = settings.SITE_BASE_URL.rstrip('/')

    # 1. Copy every WinningStatic row into the merged creatives table,
    #    preserving its original id (legacy_static_id) so the M2M
    #    relationships below can be remapped, and its original upload
    #    timestamp (created_at can't be set via .create() since it's
    #    auto_now_add, so it's fixed up with a bulk .update() after).
    id_map = {}
    for static in WinningStatic.objects.all():
        if not static.file:
            continue
        creative = GeneratedCreative.objects.create(
            workspace_id=static.workspace_id,
            name=static.name or 'Reference Photo',
            image_url=f'{base_url}{settings.MEDIA_URL}{static.file.name}',
            media_type='Photo',
            source='uploaded',
            is_edited=False,
            in_gallery=True,
            caption=static.caption,
            caption_status=static.caption_status,
            performance=static.performance,
            category=static.category,
            legacy_static_id=static.pk,
        )
        GeneratedCreative.objects.filter(pk=creative.pk).update(created_at=static.uploaded_at)
        id_map[static.pk] = creative.pk

    if not id_map:
        return

    # 2. Remap GenerationJob.statics (WinningStatic ids) onto the new
    #    GenerationJob.reference_creatives (GeneratedCreative ids).
    through = GenerationJob.statics.through
    job_static_ids = {}
    for row in through.objects.all().values_list('generationjob_id', 'winningstatic_id'):
        job_static_ids.setdefault(row[0], []).append(row[1])

    ref_through = GenerationJob.reference_creatives.through
    ref_through.objects.bulk_create([
        ref_through(generationjob_id=job_id, generatedcreative_id=id_map[old_id])
        for job_id, old_ids in job_static_ids.items()
        for old_id in old_ids
        if old_id in id_map
    ], ignore_conflicts=True)


def backwards(apps, schema_editor):
    GeneratedCreative = apps.get_model('creatives', 'GeneratedCreative')
    GeneratedCreative.objects.filter(legacy_static_id__isnull=False).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('creatives', '0010_merge_prep_schema'),
        ('brand_kit', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
