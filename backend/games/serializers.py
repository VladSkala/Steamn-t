from rest_framework import serializers

from games.models import DLC, Game, GameBundle, GameScreenshot, Genre


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
    """Read-only screenshot data with an explicit media URL contract."""

    image = serializers.SerializerMethodField()

    def get_image(self, screenshot: GameScreenshot) -> str | None:
        if not screenshot.image:
            return None

        image_url = screenshot.image.url
        request = self.context.get("request")
        if request is None:
            return image_url
        return request.build_absolute_uri(image_url)

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


class DLCSerializer(AbsoluteCoverMixin, serializers.ModelSerializer):
    cover = serializers.SerializerMethodField()
    game = GameListSerializer(read_only=True)
    is_owned = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = DLC
        fields = (
            "id", "game", "title", "description", "price", "cover",
            "hero_image_url", "release_date", "is_available", "disk_size_gb",
            "is_owned",
        )
        read_only_fields = fields


class BundleSerializer(AbsoluteCoverMixin, serializers.ModelSerializer):
    cover = serializers.SerializerMethodField()
    games = GameListSerializer(many=True, read_only=True)
    dlc = DLCSerializer(many=True, read_only=True)
    purchase_price = serializers.SerializerMethodField()
    is_owned = serializers.SerializerMethodField()

    def owned_ids(self):
        if hasattr(self, "_owned_ids"):
            return self._owned_ids
        from store.models import LibraryDLCItem, LibraryItem

        user = getattr(self.context.get("request"), "user", None)
        if user and user.is_authenticated:
            owned_games = set(
                LibraryItem.objects.filter(user=user).values_list("game_id", flat=True)
            )
            owned_dlc = set(
                LibraryDLCItem.objects.filter(user=user).values_list("dlc_id", flat=True)
            )
        else:
            owned_games, owned_dlc = set(), set()
        self._owned_ids = owned_games, owned_dlc
        return self._owned_ids

    def quote(self, bundle):
        from decimal import Decimal
        if not hasattr(self, "_quotes"):
            self._quotes = {}
        if bundle.pk in self._quotes:
            return self._quotes[bundle.pk]
        games, dlc = list(bundle.games.all()), list(bundle.dlc.all())
        owned_games, owned_dlc = self.owned_ids()
        missing = [item for item in games if item.pk not in owned_games] + [item for item in dlc if item.pk not in owned_dlc]
        total = sum((item.price for item in games + dlc), Decimal("0.00"))
        subtotal = sum((item.price for item in missing), Decimal("0.00"))
        price = min(bundle.price, (bundle.price * subtotal / total).quantize(Decimal("0.01"))) if total else Decimal("0.00")
        self._quotes[bundle.pk] = (f"{price:.2f}", not missing)
        return self._quotes[bundle.pk]

    def get_purchase_price(self, bundle):
        return self.quote(bundle)[0]

    def get_is_owned(self, bundle):
        return self.quote(bundle)[1]

    class Meta:
        model = GameBundle
        fields = ("id", "title", "description", "price", "purchase_price", "is_owned", "cover", "is_available", "games", "dlc")
        read_only_fields = fields
