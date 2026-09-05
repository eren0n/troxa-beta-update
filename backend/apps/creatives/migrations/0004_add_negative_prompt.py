from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('creatives', '0003_add_logo_to_generationjob'),
    ]

    operations = [
        migrations.AddField(
            model_name='generationjob',
            name='negative_prompt',
            field=models.TextField(blank=True, default=''),
        ),
    ]
