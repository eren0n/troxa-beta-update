from django.contrib import admin

from .models import Competitor, CompetitorAd


@admin.register(Competitor)
class CompetitorAdmin(admin.ModelAdmin):
    list_display = ('page_name', 'page_id', 'workspace', 'last_synced_at', 'next_sync_at')
    search_fields = ('page_name', 'page_id')


@admin.register(CompetitorAd)
class CompetitorAdAdmin(admin.ModelAdmin):
    list_display = ('ad_archive_id', 'competitor', 'is_active', 'start_date', 'position', 'display_format')
    list_filter = ('is_active', 'display_format')
