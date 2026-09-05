from django.contrib import admin
from .models import GenerationJob, GeneratedCreative, VideoJob, LogoJob, LogoJobImage


class GeneratedCreativeInline(admin.TabularInline):
    model = GeneratedCreative
    extra = 0
    readonly_fields = ('id', 'name', 'image_url', 'status', 'created_at')
    fields = ('name', 'image_url', 'status', 'aspect_ratio', 'created_at')
    can_delete = False


@admin.register(GenerationJob)
class GenerationJobAdmin(admin.ModelAdmin):
    list_display = ('id', 'workspace', 'created_by', 'status', 'current_step', 'model_name', 'num_images', 'created_at')
    list_filter = ('status', 'model_name', 'output_format')
    search_fields = ('workspace__name', 'created_by__email', 'master_prompt')
    readonly_fields = ('id', 'created_at')
    raw_id_fields = ('workspace', 'created_by', 'campaign', 'disclaimer')
    inlines = [GeneratedCreativeInline]


@admin.register(GeneratedCreative)
class GeneratedCreativeAdmin(admin.ModelAdmin):
    list_display = ('name', 'workspace', 'campaign', 'media_type', 'status', 'compliance', 'aspect_ratio', 'created_at')
    list_filter = ('media_type', 'status', 'compliance', 'aspect_ratio')
    search_fields = ('name', 'workspace__name')
    readonly_fields = ('id', 'created_at')
    raw_id_fields = ('workspace', 'job', 'campaign')


@admin.register(VideoJob)
class VideoJobAdmin(admin.ModelAdmin):
    list_display = ('id', 'workspace', 'created_by', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('workspace__name', 'created_by__email')
    readonly_fields = ('id', 'created_at')
    raw_id_fields = ('workspace', 'created_by', 'source_creative')


class LogoJobImageInline(admin.TabularInline):
    model = LogoJobImage
    extra = 0
    readonly_fields = ('created_at',)


@admin.register(LogoJob)
class LogoJobAdmin(admin.ModelAdmin):
    list_display = ('id', 'workspace', 'created_by', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('workspace__name',)
    readonly_fields = ('id', 'created_at')
    raw_id_fields = ('workspace', 'created_by', 'source_job')
    inlines = [LogoJobImageInline]
