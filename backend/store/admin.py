from django.contrib import admin

from store.models import (
    BundlePurchase,
    Cart,
    CartDLCItem,
    CartItem,
    LibraryCollection,
    LibraryDLCItem,
    LibraryItem,
    Order,
    OrderDLCItem,
    OrderItem,
)


class PurchaseRecordAdmin(admin.ModelAdmin):
    """Purchases and ownership are changed by checkout/refund services only."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "created_at", "updated_at")
    search_fields = ("user__username", "user__email")
    list_select_related = ("user",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ("id", "cart", "game", "created_at")
    search_fields = ("cart__user__username", "game__title")
    list_select_related = ("cart__user", "game")
    readonly_fields = ("created_at", "updated_at")


@admin.register(CartDLCItem)
class CartDLCItemAdmin(admin.ModelAdmin):
    list_display = ("id", "cart", "dlc", "created_at")
    search_fields = ("cart__user__username", "dlc__title")
    list_select_related = ("cart__user", "dlc")
    readonly_fields = ("created_at", "updated_at")


@admin.register(Order)
class OrderAdmin(PurchaseRecordAdmin):
    list_display = ("id", "user", "status", "total_price", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("user__username", "user__email")
    list_select_related = ("user",)
    readonly_fields = ("id", "user", "status", "total_price", "created_at", "updated_at")
    fields = readonly_fields
    date_hierarchy = "created_at"


@admin.register(OrderItem)
class OrderItemAdmin(PurchaseRecordAdmin):
    list_display = ("id", "order", "game", "price_at_purchase", "created_at")
    search_fields = ("order__user__username", "game__title")
    list_select_related = ("order__user", "game")
    readonly_fields = ("id", "order", "game", "price_at_purchase", "created_at", "updated_at")
    fields = readonly_fields


@admin.register(OrderDLCItem)
class OrderDLCItemAdmin(PurchaseRecordAdmin):
    list_display = ("id", "order", "dlc", "price_at_purchase", "created_at")
    search_fields = ("order__user__username", "dlc__title")
    list_select_related = ("order__user", "dlc")
    readonly_fields = ("id", "order", "dlc", "price_at_purchase", "created_at", "updated_at")
    fields = readonly_fields


@admin.register(BundlePurchase)
class BundlePurchaseAdmin(PurchaseRecordAdmin):
    list_display = ("id", "order", "bundle", "price_at_purchase", "created_at")
    search_fields = ("order__user__username", "bundle__title")
    list_select_related = ("order__user", "bundle")
    readonly_fields = ("id", "order", "bundle", "price_at_purchase", "created_at", "updated_at")
    fields = readonly_fields


@admin.register(LibraryItem)
class LibraryItemAdmin(PurchaseRecordAdmin):
    list_display = ("id", "user", "game", "order", "is_favorite", "created_at")
    list_filter = ("is_favorite", "created_at")
    search_fields = ("user__username", "user__email", "game__title")
    list_select_related = ("user", "game", "order")
    readonly_fields = (
        "id", "user", "game", "order", "price_at_purchase", "is_favorite", "created_at", "updated_at"
    )
    fields = readonly_fields


@admin.register(LibraryDLCItem)
class LibraryDLCItemAdmin(PurchaseRecordAdmin):
    list_display = ("id", "user", "dlc", "order", "created_at")
    search_fields = ("user__username", "user__email", "dlc__title")
    list_select_related = ("user", "dlc", "order")
    readonly_fields = ("id", "user", "dlc", "order", "price_at_purchase", "created_at", "updated_at")
    fields = readonly_fields


@admin.register(LibraryCollection)
class LibraryCollectionAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "user", "created_at")
    search_fields = ("name", "user__username", "user__email")
    list_select_related = ("user",)
    filter_horizontal = ("games",)
    readonly_fields = ("created_at", "updated_at")
