from django.contrib import admin
from .models import Campaign, Logo, WinningStatic, Disclaimer, DisclaimerKeyword


@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = ('name', 'workspace', 'created_by', 'created_at')
    search_fields = ('name', 'workspace__name')
    readonly_fields = ('id', 'created_at')
    raw_id_fields = ('workspace', 'created_by')


@admin.register(Logo)
class LogoAdmin(admin.ModelAdmin):
    list_display = ('name', 'workspace', 'is_primary', 'uploaded_at')
    list_filter = ('is_primary',)
    search_fields = ('name', 'workspace__name')
    raw_id_fields = ('workspace',)


@admin.register(WinningStatic)
class WinningStaticAdmin(admin.ModelAdmin):
    list_display = ('name', 'workspace', 'caption_status', 'category', 'performance', 'uploaded_at')
    list_filter = ('caption_status', 'category')
    search_fields = ('name', 'workspace__name')
    raw_id_fields = ('workspace',)


@admin.register(Disclaimer)
class DisclaimerAdmin(admin.ModelAdmin):
    list_display = ('name', 'workspace', 'category', 'is_default', 'created_at')
    list_filter = ('category', 'is_default')
    search_fields = ('name', 'text', 'workspace__name')
    raw_id_fields = ('workspace',)


@admin.register(DisclaimerKeyword)
class DisclaimerKeywordAdmin(admin.ModelAdmin):
    list_display = ('keyword', 'workspace', 'created_at')
    search_fields = ('keyword', 'workspace__name')
    raw_id_fields = ('workspace',)
