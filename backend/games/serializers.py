from rest_framework import serializers

from games.models import Game, GameScreenshot, Genre


class GenreSerializer(serializers.ModelSerializer):
    """Read-only representation of a catalog genre."""

    class Meta:
        model = Genre
        fields = ("id", "name")
        read_only_fields = fields


class AbsoluteCoverMixin:
    """Build absolute cover URLs consistently across game serializers."""

    def get_cover(self, game: Game) -> str | None:
        if not game.cover:
            return None

        cover_url = game.cover.url
        request = self.context.get("request")
        if request is None:
            return cover_url
        return request.build_absolute_uri(cover_url)


class GameListSerializer(AbsoluteCoverMixin, serializers.ModelSerializer):
    """Compact game representation used by catalog collection endpoints."""

    genres = GenreSerializer(many=True, read_only=True)
    cover = serializers.SerializerMethodField()
    is_owned = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = Game
        fields = (
            "id",
            "title",
            "description",
            "price",
            "cover",
            "developer",
            "release_date",
            "genres",
            "is_owned",
        )
        read_only_fields = fields


class GameScreenshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = GameScreenshot
        fields = ("id", "image", "caption", "position")
        read_only_fields = fields


class GameDetailSerializer(GameListSerializer):
    """Stable public detail contract used by the existing store page."""

    screenshots = GameScreenshotSerializer(many=True, read_only=True)
    average_rating = serializers.DecimalField(
        max_digits=3,
        decimal_places=2,
        read_only=True,
        allow_null=True,
    )
    review_count = serializers.IntegerField(read_only=True, default=0)

    class Meta(GameListSerializer.Meta):
        fields = (
            "id",
            "title",
            "description",
            "price",
            "cover",
            "developer",
            "release_date",
            "requirements",
            "hero_image_url",
            "screenshots",
            "genres",
            "average_rating",
            "review_count",
            "is_owned",
        )
        read_only_fields = fields
