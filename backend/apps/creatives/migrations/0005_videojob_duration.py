from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('creatives', '0004_add_negative_prompt'),
    ]

    operations = [
        migrations.AddField(
            model_name='videojob',
            name='duration',
            field=models.SmallIntegerField(default=5),
        ),
    ]
