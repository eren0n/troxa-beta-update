from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('drive_integration', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.DeleteModel(name='DriveConnection'),
        migrations.CreateModel(
            name='DriveConnection',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('drive_email', models.EmailField(blank=True, max_length=254)),
                ('access_token', models.TextField()),
                ('refresh_token', models.TextField()),
                ('token_expiry', models.DateTimeField(null=True, blank=True)),
                ('generations_folder_id', models.CharField(blank=True, max_length=200)),
                ('auto_sync', models.BooleanField(default=True)),
                ('connected_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='drive_connection',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
        ),
    ]
