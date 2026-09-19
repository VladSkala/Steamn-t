from django.urls import path
from .refunds import OrderRefundView

from store.views import (
    CartItemCreateView,
    CartItemDeleteView,
    CartDLCItemCreateView,
    CartDLCItemDeleteView,
    CartView,
    CheckoutView,
    BundleCheckoutView,
    OrderListView,
    OrderDetailView,
    LibraryCollectionDetailView,
    LibraryCollectionListCreateView,
    LibraryItemUpdateView,
    LibraryView,
)


app_name = "store"

urlpatterns = [
    path("orders/<int:order_id>/refund/", OrderRefundView.as_view()),
    path("cart/", CartView.as_view(), name="cart"),
    path("cart/items/", CartItemCreateView.as_view(), name="cart-item-create"),
    path("cart/dlc-items/", CartDLCItemCreateView.as_view(), name="cart-dlc-item-create"),
    path("cart/dlc-items/<int:dlc_id>/", CartDLCItemDeleteView.as_view(), name="cart-dlc-item-delete"),
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
    path("orders/bundles/<int:bundle_id>/checkout/", BundleCheckoutView.as_view(), name="bundle-checkout"),
    path("orders/", OrderListView.as_view(), name="order-list"),
    path("orders/<int:order_id>/", OrderDetailView.as_view(), name="order-detail"),
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
