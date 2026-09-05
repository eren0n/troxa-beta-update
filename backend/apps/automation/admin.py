from django.contrib import admin
from .models import Automation, AutomationRun


class AutomationRunInline(admin.TabularInline):
    model = AutomationRun
    extra = 0
    readonly_fields = ('status', 'started_at', 'completed_at', 'error_message')
    fields = ('status', 'started_at', 'completed_at', 'error_message')
    can_delete = False
    max_num = 10


@admin.register(Automation)
class AutomationAdmin(admin.ModelAdmin):
    list_display = ('name', 'workspace', 'trigger_type', 'is_active', 'last_run_at', 'next_run_at', 'created_at')
    list_filter = ('trigger_type', 'is_active')
    search_fields = ('name', 'workspace__name')
    readonly_fields = ('id', 'created_at')
    raw_id_fields = ('workspace', 'created_by', 'logo')
    list_editable = ('is_active',)
    inlines = [AutomationRunInline]


@admin.register(AutomationRun)
class AutomationRunAdmin(admin.ModelAdmin):
    list_display = ('automation', 'status', 'started_at', 'completed_at')
    list_filter = ('status',)
    search_fields = ('automation__name',)
    readonly_fields = ('started_at',)
    raw_id_fields = ('automation', 'generation_job', 'logo_job')
