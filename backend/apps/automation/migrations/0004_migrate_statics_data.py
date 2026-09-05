from django.db import migrations


def forwards(apps, schema_editor):
    GeneratedCreative = apps.get_model('creatives', 'GeneratedCreative')
    Automation = apps.get_model('automation', 'Automation')

    id_map = dict(
        GeneratedCreative.objects.filter(legacy_static_id__isnull=False)
        .values_list('legacy_static_id', 'id')
    )
    if not id_map:
        return

    through = Automation.statics.through
    auto_static_ids = {}
    for row in through.objects.all().values_list('automation_id', 'winningstatic_id'):
        auto_static_ids.setdefault(row[0], []).append(row[1])

    ref_through = Automation.reference_creatives.through
    ref_through.objects.bulk_create([
        ref_through(automation_id=auto_id, generatedcreative_id=id_map[old_id])
        for auto_id, old_ids in auto_static_ids.items()
        for old_id in old_ids
        if old_id in id_map
    ], ignore_conflicts=True)


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('automation', '0003_merge_prep_schema'),
        ('creatives', '0011_migrate_winningstatic_data'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
