from django.contrib import admin

from games.models import Game, GameScreenshot, Genre


class GameScreenshotInline(admin.TabularInline):
    model = GameScreenshot
    fields = ("image", "caption", "position")
    extra = 0


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


admin.site.register(Genre)
