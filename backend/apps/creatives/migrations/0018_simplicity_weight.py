from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('creatives', '0017_blend_weight'),
    ]

    operations = [
        migrations.AddField(
            model_name='generationjob',
            name='simplicity_weight',
            field=models.SmallIntegerField(blank=True, default=None, null=True),
        ),
    ]
