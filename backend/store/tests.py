from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase

from games.models import Game
from store.models import Cart, CartItem, LibraryItem, Order, OrderItem


User = get_user_model()


class StoreModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="buyer",
            email="buyer@example.com",
            password="safe-test-password",
        )
        self.game = Game.objects.create(
            title="Store Test Game",
            description="A game used to verify store relationships.",
            price=Decimal("29.99"),
            developer="Steamn't Team",
            release_date=date(2026, 8, 24),
            requirements="Test requirements",
        )

    def test_user_has_only_one_cart(self):
        Cart.objects.create(user=self.user)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Cart.objects.create(user=self.user)

    def test_cart_rejects_duplicate_game(self):
        cart = Cart.objects.create(user=self.user)
        CartItem.objects.create(cart=cart, game=self.game)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                CartItem.objects.create(cart=cart, game=self.game)

    def test_order_item_keeps_purchase_price(self):
        order = Order.objects.create(
            user=self.user,
            total_price=Decimal("19.99"),
            status=Order.Status.COMPLETED,
        )
        item = OrderItem.objects.create(
            order=order,
            game=self.game,
            price_at_purchase=Decimal("19.99"),
        )

        self.game.price = Decimal("39.99")
        self.game.save(update_fields=["price", "updated_at"])
        item.refresh_from_db()

        self.assertEqual(item.price_at_purchase, Decimal("19.99"))

    def test_library_rejects_duplicate_game_for_user(self):
        order = Order.objects.create(
            user=self.user,
            total_price=self.game.price,
            status=Order.Status.COMPLETED,
        )
        LibraryItem.objects.create(
            user=self.user,
            game=self.game,
            order=order,
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                LibraryItem.objects.create(
                    user=self.user,
                    game=self.game,
                    order=order,
                )

    def test_library_purchased_at_uses_creation_time(self):
        order = Order.objects.create(
            user=self.user,
            total_price=self.game.price,
            status=Order.Status.COMPLETED,
        )
        library_item = LibraryItem.objects.create(
            user=self.user,
            game=self.game,
            order=order,
        )

        self.assertEqual(library_item.purchased_at, library_item.created_at)
