from decimal import Decimal

from django.db import IntegrityError
from rest_framework import serializers

from games.models import Game
from store.models import Cart, CartItem, Order, OrderItem


DUPLICATE_GAME_MESSAGE = "This game is already in your cart."


class CartGameSerializer(serializers.ModelSerializer):
    """Compact game representation embedded in a cart item."""

    cover = serializers.SerializerMethodField()

    class Meta:
        model = Game
        fields = ("id", "title", "price", "cover", "developer")
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


class CartItemSerializer(serializers.ModelSerializer):
    """Read-only cart item with the game data needed by the frontend."""

    game = CartGameSerializer(read_only=True)

    class Meta:
        model = CartItem
        fields = ("id", "game", "created_at")
        read_only_fields = fields


class CartSerializer(serializers.ModelSerializer):
    """Authenticated user's cart, items and calculated total."""

    items = CartItemSerializer(many=True, read_only=True)
    total = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = ("id", "items", "total")
        read_only_fields = fields

    def get_total(self, cart: Cart) -> str:
        total = sum(
            (item.game.price for item in cart.items.all()),
            start=Decimal("0.00"),
        )
        return format(total, ".2f")


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


class OrderGameSerializer(serializers.ModelSerializer):
    """Stable game identity displayed inside a completed order."""

    cover = serializers.SerializerMethodField()

    class Meta:
        model = Game
        fields = ("id", "title", "cover", "developer")
        read_only_fields = fields

    def get_cover(self, game: Game) -> str | None:
        if not game.cover:
            return None

        cover_url = game.cover.url
        request = self.context.get("request")
        if request is None:
            return cover_url

        return request.build_absolute_uri(cover_url)


class OrderItemSerializer(serializers.ModelSerializer):
    """Purchased game with the price frozen at checkout time."""

    game = OrderGameSerializer(read_only=True)

    class Meta:
        model = OrderItem
        fields = ("id", "game", "price_at_purchase")
        read_only_fields = fields


class OrderSerializer(serializers.ModelSerializer):
    """Read-only representation returned after a successful checkout."""

    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = ("id", "status", "total_price", "items", "created_at")
        read_only_fields = fields
