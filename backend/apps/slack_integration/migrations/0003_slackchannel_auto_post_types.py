from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('slack_integration', '0002_multi_channel_content_types'),
    ]

    operations = [
        migrations.AddField(
            model_name='slackchannel',
            name='auto_post_types',
            field=models.JSONField(default=list),
        ),
    ]
