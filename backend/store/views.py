from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from store.models import Cart, CartItem, Order, OrderItem
from store.serializers import (
    CartItemCreateSerializer,
    CartSerializer,
    OrderSerializer,
)
from store.services import (
    AlreadyOwnedGamesError,
    EmptyCartError,
    checkout_user_cart,
)


EMPTY_CART_MESSAGE = "Your cart is empty."
ALREADY_OWNED_MESSAGE = (
    "Remove already owned games from your cart before checkout."
)


def get_cart_queryset():
    """Return carts with their games loaded in a bounded number of queries."""

    cart_items = CartItem.objects.select_related("game").order_by(
        "created_at",
        "pk",
    )
    return Cart.objects.prefetch_related(
        Prefetch("items", queryset=cart_items),
    )


def get_order_queryset():
    """Return orders with their immutable item prices and games prefetched."""

    order_items = OrderItem.objects.select_related("game").order_by(
        "created_at",
        "pk",
    )
    return Order.objects.prefetch_related(
        Prefetch("items", queryset=order_items),
    )


def get_or_create_user_cart(user):
    """Return the user's single active cart, creating it on first use."""

    cart, _ = Cart.objects.get_or_create(user=user)
    return cart


def serialize_cart(cart: Cart, request) -> dict:
    """Reload and serialize a cart using the optimized queryset."""

    loaded_cart = get_cart_queryset().get(pk=cart.pk)
    return CartSerializer(
        loaded_cart,
        context={"request": request},
    ).data


class CartView(APIView):
    """Return the authenticated user's cart."""

    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "head", "options")

    def get(self, request):
        cart = get_or_create_user_cart(request.user)
        return Response(serialize_cart(cart, request))


class CartItemCreateView(APIView):
    """Add one existing game to the authenticated user's cart."""

    permission_classes = (IsAuthenticated,)
    http_method_names = ("post", "options")

    def post(self, request):
        cart = get_or_create_user_cart(request.user)
        serializer = CartItemCreateSerializer(
            data=request.data,
            context={"cart": cart},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            serialize_cart(cart, request),
            status=status.HTTP_201_CREATED,
        )


class CartItemDeleteView(APIView):
    """Remove one game from only the authenticated user's cart."""

    permission_classes = (IsAuthenticated,)
    http_method_names = ("delete", "options")

    def delete(self, request, game_id: int):
        cart_item = get_object_or_404(
            CartItem,
            cart__user=request.user,
            game_id=game_id,
        )
        cart_item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CheckoutView(APIView):
    """Complete one authenticated user's cart as an atomic demo purchase."""

    permission_classes = (IsAuthenticated,)
    http_method_names = ("post", "options")

    def post(self, request):
        try:
            order = checkout_user_cart(request.user)
        except EmptyCartError:
            return Response(
                {
                    "code": "empty_cart",
                    "detail": EMPTY_CART_MESSAGE,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except AlreadyOwnedGamesError as error:
            return Response(
                {
                    "code": "already_owned",
                    "detail": ALREADY_OWNED_MESSAGE,
                    "game_ids": list(error.game_ids),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        loaded_order = get_order_queryset().get(pk=order.pk)
        serializer = OrderSerializer(
            loaded_order,
            context={"request": request},
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)
