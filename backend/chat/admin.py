from django.contrib import admin

from .models import Conversation, Message, ConversationReport


@admin.register(ConversationReport)
class ConversationReportAdmin(admin.ModelAdmin):
    list_display = ("id", "conversation", "reporter", "created_at", "resolved")
    list_filter = ("resolved",)
    readonly_fields = ("conversation", "reporter", "reason", "created_at")


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "user_low", "user_high", "updated_at")
    search_fields = ("user_low__username", "user_high__username")
    readonly_fields = ("created_at", "updated_at")


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "conversation", "sender", "kind", "created_at", "read_at")
    list_filter = ("kind", "read_at")
    search_fields = ("sender__username", "body", "attachment_name")
    readonly_fields = ("created_at",)
    exclude = ("attachment",)
