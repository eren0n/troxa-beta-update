from django.db import migrations


def _display_name(user):
    # Historical migration models don't carry custom methods like
    # get_full_name(), just fields — replicate the same logic by hand.
    if not user:
        return ''
    full = f'{user.first_name} {user.last_name}'.strip()
    return full or user.email


def forwards(apps, schema_editor):
    GeneratedCreative = apps.get_model('creatives', 'GeneratedCreative')

    # `generated_by` used to be (mis)populated with the AI model name for a
    # lot of existing rows (e.g. "Nano Banana 2") — overwrite unconditionally
    # rather than only filling blanks, so that bad data gets corrected too.

    # AI-generated creatives — attribute to whoever kicked off the job.
    qs = GeneratedCreative.objects.filter(job__isnull=False).select_related('job__created_by')
    for creative in qs.iterator():
        name = _display_name(creative.job.created_by)
        GeneratedCreative.objects.filter(pk=creative.pk).update(generated_by=name)

    # Directly uploaded (or otherwise job-less) creatives — attribute to
    # whoever uploaded them; no way to trace authorship if that's blank too.
    qs = GeneratedCreative.objects.filter(job__isnull=True, uploaded_by__isnull=False).select_related('uploaded_by')
    for creative in qs.iterator():
        name = _display_name(creative.uploaded_by)
        GeneratedCreative.objects.filter(pk=creative.pk).update(generated_by=name)

    # Job-less, uploader-less rows (old AI-edit/erase/save-canvas drafts from
    # before authorship was tracked) — nothing to attribute to; clear the
    # stale model-name value rather than leave it misleading.
    GeneratedCreative.objects.filter(job__isnull=True, uploaded_by__isnull=True).exclude(generated_by='').update(generated_by='')


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('creatives', '0011_migrate_winningstatic_data'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
