from decimal import Decimal

from django.db import IntegrityError
from django.db.models import Q
from rest_framework import serializers

from games.models import DLC, Game
from store.models import (
    Cart,
    CartDLCItem,
    CartItem,
    LibraryCollection,
    LibraryItem,
    Order,
    OrderDLCItem,
    OrderItem,
    BundlePurchase,
)


DUPLICATE_GAME_MESSAGE = "This game is already in your cart."


class AbsoluteCoverMixin:
    def get_cover(self, game: Game) -> str | None:
        if not game.cover:
            return None

        cover_url = game.cover.url
        request = self.context.get("request")
        if request is None:
            return cover_url
        return request.build_absolute_uri(cover_url)


class CartGameSerializer(AbsoluteCoverMixin, serializers.ModelSerializer):
    """Compact game representation embedded in a cart item."""

    cover = serializers.SerializerMethodField()

    class Meta:
        model = Game
        fields = ("id", "title", "price", "cover", "developer")
        read_only_fields = fields


class CartItemSerializer(serializers.ModelSerializer):
    """Read-only cart item with the game data needed by the frontend."""

    game = CartGameSerializer(read_only=True)

    class Meta:
        model = CartItem
        fields = ("id", "game", "created_at")
        read_only_fields = fields


class CartDLCSerializer(AbsoluteCoverMixin, serializers.ModelSerializer):
    cover = serializers.SerializerMethodField()

    class Meta:
        model = DLC
        fields = ("id", "title", "price", "cover", "game_id")
        read_only_fields = fields


class CartDLCItemSerializer(serializers.ModelSerializer):
    dlc = CartDLCSerializer(read_only=True)

    class Meta:
        model = CartDLCItem
        fields = ("id", "dlc", "created_at")
        read_only_fields = fields


class CartSerializer(serializers.ModelSerializer):
    """Authenticated user's cart, items and calculated total."""

    items = CartItemSerializer(many=True, read_only=True)
    dlc_items = CartDLCItemSerializer(many=True, read_only=True)
    total = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = ("id", "items", "dlc_items", "total")
        read_only_fields = fields

    def get_total(self, cart: Cart) -> str:
        total = sum(
            (item.game.price for item in cart.items.all()),
            start=Decimal("0.00"),
        ) + sum((item.dlc.price for item in cart.dlc_items.all()), start=Decimal("0.00"))
        return format(total, ".2f")


class CartDLCItemCreateSerializer(serializers.ModelSerializer):
    dlc_id = serializers.PrimaryKeyRelatedField(
        queryset=DLC.objects.filter(is_available=True), source="dlc", write_only=True,
    )

    class Meta:
        model = CartDLCItem
        fields = ("dlc_id",)

    def validate_dlc_id(self, dlc):
        cart = self.context["cart"]
        if CartDLCItem.objects.filter(cart=cart, dlc=dlc).exists():
            raise serializers.ValidationError("This DLC is already in your cart.")
        return dlc

    def create(self, validated_data):
        try:
            return CartDLCItem.objects.create(cart=self.context["cart"], **validated_data)
        except IntegrityError as error:
            raise serializers.ValidationError({"dlc_id": "This DLC is already in your cart."}) from error


class CartItemCreateSerializer(serializers.ModelSerializer):
    """Validate one game before adding it to the current user's cart."""

    game_id = serializers.PrimaryKeyRelatedField(
        queryset=Game.objects.all(),
        source="game",
        write_only=True,
    )

    class Meta:
        model = CartItem
        fields = ("game_id",)

    def validate_game_id(self, game: Game) -> Game:
        cart = self.context["cart"]
        if CartItem.objects.filter(cart=cart, game=game).exists():
            raise serializers.ValidationError(DUPLICATE_GAME_MESSAGE)
        return game

    def create(self, validated_data):
        try:
            return CartItem.objects.create(
                cart=self.context["cart"],
                **validated_data,
            )
        except IntegrityError as error:
            raise serializers.ValidationError(
                {"game_id": DUPLICATE_GAME_MESSAGE},
            ) from error


class OrderGameSerializer(AbsoluteCoverMixin, serializers.ModelSerializer):
    """Stable game identity displayed inside orders and KAN-22 library rows."""

    cover = serializers.SerializerMethodField()

    class Meta:
        model = Game
        fields = ("id", "title", "cover", "developer")
        read_only_fields = fields


class OrderItemSerializer(serializers.ModelSerializer):
    """Purchased game with the price frozen at checkout time."""

    game = OrderGameSerializer(read_only=True)

    class Meta:
        model = OrderItem
        fields = ("id", "game", "price_at_purchase")
        read_only_fields = fields


class OrderDLCItemSerializer(serializers.ModelSerializer):
    dlc = CartDLCSerializer(read_only=True)

    class Meta:
        model = OrderDLCItem
        fields = ("id", "dlc", "price_at_purchase")
        read_only_fields = fields


class BundlePurchaseSerializer(serializers.ModelSerializer):
    title = serializers.CharField(source="bundle.title", read_only=True)

    class Meta:
        model = BundlePurchase
        fields = ("id", "bundle_id", "title", "price_at_purchase")
        read_only_fields = fields


class OrderSerializer(serializers.ModelSerializer):
    """Read-only representation returned after a successful checkout."""

    items = OrderItemSerializer(many=True, read_only=True)
    dlc_items = OrderDLCItemSerializer(many=True, read_only=True)
    bundles = BundlePurchaseSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = ("id", "status", "total_price", "items", "dlc_items", "bundles", "created_at")
        read_only_fields = fields


class LibraryItemSerializer(serializers.ModelSerializer):
    """Stable KAN-22 purchased-game response contract."""

    game = OrderGameSerializer(read_only=True)
    purchased_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = LibraryItem
        fields = ("id", "game", "price_at_purchase", "purchased_at")
        read_only_fields = fields


class LibraryItemUpdateSerializer(serializers.ModelSerializer):
    """Update only state owned by the library-item owner."""

    class Meta:
        model = LibraryItem
        fields = ("is_favorite",)


class LibraryCollectionSerializer(serializers.ModelSerializer):
    """Read and write a named collection containing owned games only."""

    game_ids = serializers.PrimaryKeyRelatedField(
        source="games",
        queryset=Game.objects.all(),
        many=True,
        required=False,
    )

    class Meta:
        model = LibraryCollection
        fields = ("id", "name", "game_ids", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_name(self, value: str) -> str:
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Collection name cannot be empty.")

        queryset = LibraryCollection.objects.filter(
            user=self.context["request"].user,
            name__iexact=name,
        )
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError(
                "You already have a collection with this name.",
            )
        return name

    def validate_game_ids(self, games: list[Game]) -> list[Game]:
        user = self.context["request"].user
        game_ids = {game.pk for game in games}
        owned_ids = set(
            LibraryItem.objects.filter(
                user=user,
                game_id__in=game_ids,
            ).filter(Q(order__isnull=True) | Q(order__user=user)).values_list("game_id", flat=True),
        )
        if owned_ids != game_ids:
            raise serializers.ValidationError(
                "Collections can contain only games in your library.",
            )
        return games

    def create(self, validated_data):
        games = validated_data.pop("games", [])
        collection = LibraryCollection.objects.create(
            user=self.context["request"].user,
            **validated_data,
        )
        collection.games.set(games)
        return collection

    def update(self, instance, validated_data):
        games = validated_data.pop("games", None)
        instance.name = validated_data.get("name", instance.name)
        instance.save(update_fields=["name", "updated_at"])
        if games is not None:
            instance.games.set(games)
        return instance
