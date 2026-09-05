from django.contrib import admin
from .models import Plan, Subscription, CreditTransaction


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display  = ('name', 'tier', 'monthly_credits', 'member_limit', 'unlimited_usage', 'price_monthly', 'is_active')
    list_filter   = ('tier', 'is_active', 'unlimited_usage')
    search_fields = ('name',)
    list_editable = ('is_active',)


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display  = ('workspace', 'plan', 'status', 'monthly_usage', 'credit_bonus', 'credit_used', 'current_period_end', 'updated_at')
    list_filter   = ('status', 'plan')
    search_fields = ('workspace__name',)
    readonly_fields = ('created_at', 'updated_at')
    raw_id_fields   = ('workspace',)


@admin.register(CreditTransaction)
class CreditTransactionAdmin(admin.ModelAdmin):
    list_display  = ('workspace', 'amount', 'transaction_type', 'reference_type', 'description', 'created_at')
    list_filter   = ('transaction_type', 'reference_type')
    search_fields = ('workspace__name', 'description')
    readonly_fields = ('created_at',)
    raw_id_fields   = ('workspace',)
