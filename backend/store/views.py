from django.db.models import Prefetch, Q
from rest_framework.pagination import PageNumberPagination
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from store.models import (
    Cart,
    CartDLCItem,
    CartItem,
    LibraryCollection,
    LibraryItem,
    Order,
    OrderDLCItem,
    OrderItem,
)
from store.serializers import (
    CartItemCreateSerializer,
    CartDLCItemCreateSerializer,
    CartSerializer,
    LibraryCollectionSerializer,
    LibraryItemSerializer,
    LibraryItemUpdateSerializer,
    OrderSerializer,
)
from store.services import (
    AlreadyOwnedGamesError,
    EmptyCartError,
    OrderTotalOverflowError,
    DLCRequirementError,
    BundleUnavailableError,
    checkout_bundle,
    checkout_user_cart,
)


EMPTY_CART_MESSAGE = "Your cart is empty."
ALREADY_OWNED_MESSAGE = (
    "Remove already owned games from your cart before checkout."
)
CART_ALREADY_OWNED_MESSAGE = "This game is already in your library."
ORDER_TOTAL_OVERFLOW_MESSAGE = (
    "The cart total is too large to create an order. Remove one or more games."
)


def get_cart_queryset():
    """Return carts with their games loaded in a bounded number of queries."""

    cart_items = CartItem.objects.select_related("game").order_by(
        "created_at",
        "pk",
    )
    dlc_items = CartDLCItem.objects.select_related("dlc").order_by("created_at", "pk")
    return Cart.objects.prefetch_related(
        Prefetch("items", queryset=cart_items),
        Prefetch("dlc_items", queryset=dlc_items),
    )


def get_order_queryset():
    """Return orders with their immutable item prices and games prefetched."""

    order_items = OrderItem.objects.select_related("game").order_by(
        "created_at",
        "pk",
    )
    dlc_items = OrderDLCItem.objects.select_related("dlc").order_by("created_at", "pk")
    return Order.objects.prefetch_related(
        Prefetch("items", queryset=order_items),
        Prefetch("dlc_items", queryset=dlc_items),
        "bundles__bundle",
    )


def get_library_queryset(user):
    """Return permanent game ownership belonging to one authenticated user."""

    user_collections = LibraryCollection.objects.filter(user=user).only(
        "id",
        "user_id",
    )
    return (
        LibraryItem.objects.filter(user=user).filter(Q(order__isnull=True) | Q(order__user=user))
        .select_related("game")
        .prefetch_related(
            Prefetch(
                "game__library_collections",
                queryset=user_collections,
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
        game = serializer.validated_data["game"]
        if LibraryItem.objects.filter(
            user=request.user,
            game=game,
        ).exists():
            return Response(
                {
                    "code": "already_owned",
                    "detail": CART_ALREADY_OWNED_MESSAGE,
                    "game_ids": [game.pk],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
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


class CartDLCItemCreateView(APIView):
    permission_classes = (IsAuthenticated,)
    http_method_names = ("post", "options")

    def post(self, request):
        cart = get_or_create_user_cart(request.user)
        serializer = CartDLCItemCreateSerializer(data=request.data, context={"cart": cart})
        serializer.is_valid(raise_exception=True)
        dlc = serializer.validated_data["dlc"]
        from store.models import LibraryDLCItem
        if LibraryDLCItem.objects.filter(user=request.user, dlc=dlc).exists():
            return Response({"code": "already_owned", "detail": "You already own this DLC."}, status=400)
        if not LibraryItem.objects.filter(user=request.user, game=dlc.game).exists() and not CartItem.objects.filter(cart=cart, game=dlc.game).exists():
            return Response({"code": "base_game_required", "detail": "Add or own the base game first."}, status=400)
        serializer.save()
        return Response(serialize_cart(cart, request), status=201)


class CartDLCItemDeleteView(APIView):
    permission_classes = (IsAuthenticated,)
    http_method_names = ("delete", "options")

    def delete(self, request, dlc_id):
        item = get_object_or_404(CartDLCItem, cart__user=request.user, dlc_id=dlc_id)
        item.delete()
        return Response(status=204)


class CheckoutView(APIView):
    permission_classes = (IsAuthenticated,)
    http_method_names = ("post", "options")

    def post(self, request):
        try:
            order = checkout_user_cart(request.user, request.data.get("payment_method", "demo"))
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
        except OrderTotalOverflowError:
            return Response(
                {
                    "code": "order_total_too_large",
                    "detail": ORDER_TOTAL_OVERFLOW_MESSAGE,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except DLCRequirementError as error:
            return Response({"code": "dlc_requirement", "detail": str(error)}, status=400)

        loaded_order = get_order_queryset().get(pk=order.pk)
        serializer = OrderSerializer(
            loaded_order,
            context={"request": request},
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class BundleCheckoutView(APIView):
    permission_classes = (IsAuthenticated,)
    http_method_names = ("post", "options")

    def post(self, request, bundle_id):
        try:
            order = checkout_bundle(request.user, bundle_id, request.data.get("payment_method", "demo"))
        except (BundleUnavailableError, DLCRequirementError, OrderTotalOverflowError) as error:
            return Response({"detail": str(error)}, status=400)
        loaded = get_order_queryset().get(pk=order.pk)
        return Response(OrderSerializer(loaded, context={"request": request}).data, status=201)


class OrderPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50


class OrderListView(APIView):
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "head", "options")

    def get(self, request):
        queryset = get_order_queryset().filter(user=request.user).order_by("-created_at", "-pk")
        paginator = OrderPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        data = OrderSerializer(page, many=True, context={"request": request}).data
        return paginator.get_paginated_response(data)


class OrderDetailView(APIView):
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "head", "options")

    def get(self, request, order_id):
        order = get_object_or_404(get_order_queryset(), pk=order_id, user=request.user)
        return Response(OrderSerializer(order, context={"request": request}).data)


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
            LibraryItem.objects.filter(Q(order__isnull=True) | Q(order__user=request.user)),
            pk=item_id,
            user=request.user,
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
