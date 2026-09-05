from django.apps import AppConfig


class BrandKitConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.brand_kit'

    def ready(self):
        import apps.brand_kit.signals  # noqa: F401 — register post_save signal
