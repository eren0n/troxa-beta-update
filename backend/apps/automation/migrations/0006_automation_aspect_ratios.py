from django.contrib.postgres.fields import ArrayField
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('automation', '0005_automation_gen_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='automation',
            name='aspect_ratios',
            field=ArrayField(
                base_field=models.CharField(max_length=20),
                blank=True,
                default=list,
            ),
        ),
        migrations.AlterField(
            model_name='automation',
            name='generation_mode',
            field=models.CharField(default='auto', max_length=20),
        ),
    ]
