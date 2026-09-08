from django.contrib import admin
from django.db.models import Count

from games.models import Game, GameScreenshot, Genre


class GameScreenshotInline(admin.TabularInline):
    model = GameScreenshot
    fields = ("image", "caption", "position")
    extra = 0
    ordering = ("position", "pk")


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "developer",
        "price",
        "release_date",
        "is_featured",
    )
    list_filter = ("is_featured", "genres")
    list_editable = ("is_featured",)
    search_fields = ("title", "developer")
    filter_horizontal = ("genres",)
    inlines = (GameScreenshotInline,)
    ordering = ("title", "pk")
    list_per_page = 50


@admin.register(Genre)
class GenreAdmin(admin.ModelAdmin):
    list_display = ("name", "game_count")
    search_fields = ("name",)
    ordering = ("name",)

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _game_count=Count("games", distinct=True),
        )

    @admin.display(description="Games", ordering="_game_count")
    def game_count(self, obj):
        return obj._game_count
