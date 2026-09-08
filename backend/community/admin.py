from django.contrib import admin

from community.models import (
    CommunityPost,
    GameReview,
    GameReviewImage,
    GameWishlist,
    PostComment,
    PostReaction,
    UserFollow,
)


class GameReviewImageInline(admin.TabularInline):
    model = GameReviewImage
    fields = ("image", "position")
    extra = 0
    ordering = ("position", "pk")


@admin.register(GameReview)
class GameReviewAdmin(admin.ModelAdmin):
    list_display = ("game", "user", "rating", "created_at", "updated_at")
    list_filter = ("rating", "created_at", "updated_at")
    search_fields = ("game__title", "user__username", "user__email", "body")
    list_select_related = ("game", "user")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-updated_at", "-pk")
    date_hierarchy = "created_at"
    inlines = (GameReviewImageInline,)


admin.site.register(CommunityPost)
admin.site.register(PostReaction)
admin.site.register(PostComment)
admin.site.register(UserFollow)
admin.site.register(GameWishlist)
