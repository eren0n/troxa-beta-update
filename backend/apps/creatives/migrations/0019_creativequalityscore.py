from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('creatives', '0018_simplicity_weight'),
    ]

    operations = [
        migrations.CreateModel(
            name='CreativeQualityScore',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('brand_alignment', models.SmallIntegerField(blank=True, null=True)),
                ('ad_effectiveness', models.SmallIntegerField(blank=True, null=True)),
                ('text_quality', models.SmallIntegerField(blank=True, null=True)),
                ('production_quality', models.SmallIntegerField(blank=True, null=True)),
                ('offer_accuracy', models.SmallIntegerField(blank=True, null=True)),
                ('overall', models.FloatField(blank=True, null=True)),
                ('verdict', models.CharField(blank=True, choices=[('pass', 'Pass'), ('review', 'Review'), ('fail', 'Fail')], max_length=10, null=True)),
                ('notes', models.TextField(blank=True)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('done', 'Done'), ('error', 'Error')], default='pending', max_length=20)),
                ('evaluated_at', models.DateTimeField(blank=True, null=True)),
                ('creative', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='quality_score', to='creatives.generatedcreative')),
            ],
            options={
                'indexes': [models.Index(fields=['status'], name='creatives_c_status_idx')],
            },
        ),
    ]
