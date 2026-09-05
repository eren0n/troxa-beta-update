from django.contrib import admin
from .models import APIKey


@admin.register(APIKey)
class APIKeyAdmin(admin.ModelAdmin):
    list_display = ('name', 'workspace', 'key_prefix', 'created_by', 'is_active', 'last_used_at', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'workspace__name', 'key_prefix')
    readonly_fields = ('key_prefix', 'key_hash', 'created_at')
    raw_id_fields = ('workspace', 'created_by')
    list_editable = ('is_active',)
