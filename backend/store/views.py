from django.db.models import DecimalField, OuterRef, Prefetch, Subquery
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from store.models import (
    Cart,
    CartItem,
    LibraryCollection,
    LibraryItem,
    Order,
    OrderItem,
)
from store.serializers import (
    CartItemCreateSerializer,
    CartSerializer,
    LibraryCollectionSerializer,
    LibraryItemSerializer,
    LibraryItemUpdateSerializer,
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


def get_library_queryset(user):
    """Return completed purchases belonging only to one authenticated user."""

    purchase_price = (
        OrderItem.objects.filter(
            order_id=OuterRef("order_id"),
            game_id=OuterRef("game_id"),
        )
        .order_by()
        .values("price_at_purchase")[:1]
    )
    user_collections = LibraryCollection.objects.filter(user=user).only(
        "id",
        "user_id",
    )
    return (
        LibraryItem.objects.filter(
            user=user,
            order__user=user,
            order__status=Order.Status.COMPLETED,
        )
        .select_related("game")
        .prefetch_related(
            Prefetch(
                "game__library_collections",
                queryset=user_collections,
            ),
        )
        .annotate(
            annotated_price_at_purchase=Subquery(
                purchase_price,
                output_field=DecimalField(max_digits=10, decimal_places=2),
            ),
        )
        .order_by("-created_at", "-pk")
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
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "head", "options")

    def get(self, request):
        cart = get_or_create_user_cart(request.user)
        return Response(serialize_cart(cart, request))


class CartItemCreateView(APIView):
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
    permission_classes = (IsAuthenticated,)
    http_method_names = ("post", "options")

    def post(self, request):
        try:
            order = checkout_user_cart(request.user)
        except EmptyCartError:
            return Response(
                {"code": "empty_cart", "detail": EMPTY_CART_MESSAGE},
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


class LibraryView(APIView):
    """Return only the authenticated user's completed purchases."""

    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "head", "options")

    def get(self, request):
        serializer = LibraryItemSerializer(
            get_library_queryset(request.user),
            many=True,
            context={"request": request},
        )
        return Response({"items": serializer.data})


class LibraryItemUpdateView(APIView):
    """Update favorite state without allowing ownership changes."""

    permission_classes = (IsAuthenticated,)
    http_method_names = ("patch", "options")

    def patch(self, request, item_id: int):
        item = get_object_or_404(
            LibraryItem,
            pk=item_id,
            user=request.user,
            order__status=Order.Status.COMPLETED,
        )
        serializer = LibraryItemUpdateSerializer(
            item,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"id": item.pk, "is_favorite": item.is_favorite},
        )


class LibraryCollectionListCreateView(APIView):
    """List or create collections owned by the authenticated user."""

    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "post", "head", "options")

    def get(self, request):
        collections = LibraryCollection.objects.filter(user=request.user).prefetch_related(
            "games",
        )
        serializer = LibraryCollectionSerializer(
            collections,
            many=True,
            context={"request": request},
        )
        return Response({"items": serializer.data})

    def post(self, request):
        serializer = LibraryCollectionSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class LibraryCollectionDetailView(APIView):
    """Read, update, or delete one collection owned by the caller."""

    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "put", "patch", "delete", "head", "options")

    def get_object(self, request, collection_id: int) -> LibraryCollection:
        return get_object_or_404(
            LibraryCollection.objects.prefetch_related("games"),
            pk=collection_id,
            user=request.user,
        )

    def get(self, request, collection_id: int):
        serializer = LibraryCollectionSerializer(
            self.get_object(request, collection_id),
            context={"request": request},
        )
        return Response(serializer.data)

    def put(self, request, collection_id: int):
        return self._update(request, collection_id, partial=False)

    def patch(self, request, collection_id: int):
        return self._update(request, collection_id, partial=True)

    def _update(self, request, collection_id: int, partial: bool):
        serializer = LibraryCollectionSerializer(
            self.get_object(request, collection_id),
            data=request.data,
            partial=partial,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, collection_id: int):
        self.get_object(request, collection_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
