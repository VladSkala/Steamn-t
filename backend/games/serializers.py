from rest_framework import serializers

from games.models import Game, Genre


class GenreSerializer(serializers.ModelSerializer):
    """Read-only representation of a catalog genre."""

    class Meta:
        model = Genre
        fields = ("id", "name")
        read_only_fields = fields


class GameListSerializer(serializers.ModelSerializer):
    """Compact game representation used by catalog collection endpoints."""

    genres = GenreSerializer(many=True, read_only=True)
    cover = serializers.SerializerMethodField()

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
        )
        read_only_fields = fields

    def get_cover(self, game: Game) -> str | None:
        """Return an absolute media URL when a cover exists."""

        if not game.cover:
            return None

        cover_url = game.cover.url
        request = self.context.get("request")
        if request is None:
            return cover_url

        return request.build_absolute_uri(cover_url)
