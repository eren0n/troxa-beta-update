from django.contrib import admin
from .models import BrandFingerprint, ImageAnalysisRecord


@admin.register(BrandFingerprint)
class BrandFingerprintAdmin(admin.ModelAdmin):
    list_display = ("workspace", "confidence", "based_on_image_count", "brand_profile_version", "visual_dna_version", "updated_at")
    readonly_fields = ("workspace", "brand_profile_version", "visual_dna_version", "based_on_image_count", "updated_at", "last_full_recreate_at")
    search_fields = ("workspace__name",)


@admin.register(ImageAnalysisRecord)
class ImageAnalysisRecordAdmin(admin.ModelAdmin):
    list_display = ("workspace", "source", "sentiment", "rating", "included_in_fingerprint_version", "created_at")
    list_filter = ("source", "sentiment")
    readonly_fields = ("workspace", "image_url", "source", "creative", "winning_static", "rating", "sentiment", "analysis", "included_in_fingerprint_version", "created_at")
    search_fields = ("workspace__name",)
