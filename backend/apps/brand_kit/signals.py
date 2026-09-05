"""
Brand kit signals — wired in BrandKitConfig.ready().
"""
from django.db.models.signals import post_save
from django.dispatch import receiver

# Words that must never appear as visible text in any generated creative.
# Automatically added to every workspace on creation.
DEFAULT_BLACKLIST_KEYWORDS = ['bet', 'betting']


@receiver(post_save, sender='accounts.Workspace')
def add_default_disclaimer_keywords(sender, instance, created, **kwargs):
    """Seed default banned keywords for every new workspace."""
    if not created:
        return
    from .models import DisclaimerKeyword
    for kw in DEFAULT_BLACKLIST_KEYWORDS:
        DisclaimerKeyword.objects.get_or_create(workspace=instance, keyword=kw)
