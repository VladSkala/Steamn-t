from django.urls import path

from store.views import (
    CartItemCreateView,
    CartItemDeleteView,
    CartView,
    CheckoutView,
    LibraryCollectionDetailView,
    LibraryCollectionListCreateView,
    LibraryItemUpdateView,
    LibraryView,
)


app_name = "store"

urlpatterns = [
    path("cart/", CartView.as_view(), name="cart"),
    path("cart/items/", CartItemCreateView.as_view(), name="cart-item-create"),
    path(
        "cart/items/<int:game_id>/",
        CartItemDeleteView.as_view(),
        name="cart-item-delete",
    ),
    path(
        "orders/checkout/",
        CheckoutView.as_view(),
        name="order-checkout",
    ),
    path("library/", LibraryView.as_view(), name="library"),
    path(
        "library/items/<int:item_id>/",
        LibraryItemUpdateView.as_view(),
        name="library-item-update",
    ),
    path(
        "library/collections/",
        LibraryCollectionListCreateView.as_view(),
        name="library-collections",
    ),
    path(
        "library/collections/<int:collection_id>/",
        LibraryCollectionDetailView.as_view(),
        name="library-collection-detail",
    ),
]
