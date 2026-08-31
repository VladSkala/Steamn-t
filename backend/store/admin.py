from django.contrib import admin

from store.models import Cart, CartItem, LibraryCollection, LibraryItem, Order, OrderItem


admin.site.register(Cart)
admin.site.register(CartItem)
admin.site.register(Order)
admin.site.register(OrderItem)
admin.site.register(LibraryItem)
admin.site.register(LibraryCollection)
