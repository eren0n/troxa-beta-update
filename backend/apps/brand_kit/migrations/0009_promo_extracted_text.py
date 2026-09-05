from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('brand_kit', '0008_campaign_campaign_brief_campaign_objective_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='promo',
            name='extracted_text',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='promo',
            name='extraction_status',
            field=models.CharField(
                choices=[('pending', 'Pending'), ('done', 'Done'), ('error', 'Error')],
                default='pending',
                max_length=20,
            ),
        ),
    ]
