from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from users.models import (
    Notification,
    ProfileComment,
    User,
    UserBadge,
    UserBlock,
    WalletTransaction,
)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = (
        "username", "email", "first_name", "last_name", "is_staff", "is_active", "date_joined"
    )
    list_filter = ("is_staff", "is_superuser", "is_active", "language", "date_joined")
    search_fields = ("username", "email", "first_name", "last_name")
    ordering = ("username",)
    readonly_fields = ("last_login", "date_joined", "last_seen_at")
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Steamn’t profile", {"fields": ("avatar", "cover", "bio", "language", "dark_theme", "last_seen_at")}),
        ("Privacy", {"fields": (
            "privacy_games", "privacy_wishlist", "privacy_friends", "privacy_activity",
            "privacy_messages", "show_online",
        )}),
        ("Notifications", {"fields": ("notification_preferences",)}),
    )
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        ("Contact", {"fields": ("email",)}),
    )


@admin.register(UserBlock)
class UserBlockAdmin(admin.ModelAdmin):
    list_display = ("id", "blocker", "blocked", "created_at")
    search_fields = ("blocker__username", "blocker__email", "blocked__username", "blocked__email")
    list_select_related = ("blocker", "blocked")
    readonly_fields = ("created_at",)


@admin.register(UserBadge)
class UserBadgeAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "code", "points", "earned_at")
    search_fields = ("name", "code", "user__username", "user__email")
    list_select_related = ("user",)
    readonly_fields = ("earned_at",)


@admin.register(ProfileComment)
class ProfileCommentAdmin(admin.ModelAdmin):
    list_display = ("id", "profile", "author", "created_at", "updated_at")
    search_fields = ("profile__username", "author__username", "body")
    list_select_related = ("profile", "author")
    readonly_fields = ("created_at", "updated_at")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "kind", "title", "created_at", "read_at")
    list_filter = ("kind", "created_at", "read_at")
    search_fields = ("user__username", "user__email", "title", "body")
    list_select_related = ("user",)
    readonly_fields = ("created_at",)


@admin.register(WalletTransaction)
class WalletTransactionAdmin(admin.ModelAdmin):
    """Expose the financial journal without allowing edits that corrupt balances."""

    list_display = ("id", "user", "kind", "amount", "order", "created_at")
    list_filter = ("kind", "created_at")
    search_fields = ("user__username", "user__email", "description", "event_key")
    list_select_related = ("user", "order")
    readonly_fields = (
        "id", "user", "amount", "kind", "description", "order", "event_key", "created_at"
    )
    fields = readonly_fields
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
