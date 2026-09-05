from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('automation', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='automation',
            name='style',
            field=models.CharField(blank=True, max_length=100),
        ),
    ]
