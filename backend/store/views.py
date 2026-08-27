from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from store.models import Cart, CartItem
from store.serializers import CartItemCreateSerializer, CartSerializer


def get_cart_queryset():
    """Return carts with their games loaded in a bounded number of queries."""

    cart_items = CartItem.objects.select_related("game").order_by(
        "created_at",
        "pk",
    )
    return Cart.objects.prefetch_related(
        Prefetch("items", queryset=cart_items),
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
