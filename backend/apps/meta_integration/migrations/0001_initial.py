from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('accounts', '0001_initial'),
        ('creatives', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='MetaConnection',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('access_token',     models.TextField()),
                ('token_expires_at', models.DateTimeField(blank=True, null=True)),
                ('fb_user_id',       models.CharField(blank=True, max_length=50)),
                ('fb_user_name',     models.CharField(blank=True, max_length=200)),
                ('ad_account_id',    models.CharField(blank=True, max_length=50)),
                ('ad_account_name',  models.CharField(blank=True, max_length=200)),
                ('page_id',          models.CharField(blank=True, max_length=50)),
                ('page_name',        models.CharField(blank=True, max_length=200)),
                ('connected_at',     models.DateTimeField(auto_now_add=True)),
                ('workspace', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='meta_connection',
                    to='accounts.workspace',
                )),
            ],
        ),
        migrations.CreateModel(
            name='MetaCreativeLink',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ad_id',           models.CharField(blank=True, max_length=50)),
                ('ad_creative_id',  models.CharField(blank=True, max_length=50)),
                ('image_hash',      models.CharField(blank=True, max_length=100)),
                ('campaign_id',     models.CharField(blank=True, max_length=50)),
                ('campaign_name',   models.CharField(blank=True, max_length=200)),
                ('adset_id',        models.CharField(blank=True, max_length=50)),
                ('adset_name',      models.CharField(blank=True, max_length=200)),
                ('linked_at',       models.DateTimeField(auto_now_add=True)),
                ('impressions',     models.BigIntegerField(default=0)),
                ('clicks',          models.BigIntegerField(default=0)),
                ('spend',           models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('ctr',             models.DecimalField(decimal_places=4, default=0, max_digits=8)),
                ('cpm',             models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('reach',           models.BigIntegerField(default=0)),
                ('metrics_updated_at', models.DateTimeField(blank=True, null=True)),
                ('creative', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='meta_link',
                    to='creatives.generatedcreative',
                )),
            ],
        ),
    ]
