from django.urls import path

from store.views import (
    CartItemCreateView,
    CartItemDeleteView,
    CartView,
    CheckoutView,
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
]
