from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from games.models import Game
from store.models import Cart, CartItem, LibraryItem, Order, OrderItem


User = get_user_model()


class CheckoutAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="checkout-owner",
            email="checkout-owner@example.com",
            password="safe-test-password",
        )
        self.other_user = User.objects.create_user(
            username="other-checkout-owner",
            email="other-checkout-owner@example.com",
            password="safe-test-password",
        )
        self.game = Game.objects.create(
            title="Checkout Game",
            description="A game used to verify checkout.",
            price=Decimal("19.99"),
            cover="games/covers/2026/08/checkout-game.webp",
            developer="Checkout Studio",
            release_date=date(2026, 8, 29),
            requirements="8 GB RAM",
        )
        self.second_game = Game.objects.create(
            title="Second Checkout Game",
            description="A second game used to verify order totals.",
            price=Decimal("5.01"),
            developer="Second Checkout Studio",
            release_date=date(2026, 8, 28),
            requirements="4 GB RAM",
        )
        self.checkout_url = reverse("store:order-checkout")

    def authenticate(self, user=None):
        self.client.force_authenticate(user=user or self.user)

    @staticmethod
    def fill_cart(user, *games):
        cart, _ = Cart.objects.get_or_create(user=user)
        for game in games:
            CartItem.objects.create(cart=cart, game=game)
        return cart

    @staticmethod
    def grant_purchase(user, game):
        order = Order.objects.create(
            user=user,
            total_price=game.price,
            status=Order.Status.COMPLETED,
        )
        OrderItem.objects.create(
            order=order,
            game=game,
            price_at_purchase=game.price,
        )
        LibraryItem.objects.create(
            user=user,
            game=game,
            order=order,
        )
        return order

    def test_checkout_requires_authentication(self):
        self.fill_cart(self.user, self.game)

        response = self.client.post(self.checkout_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(Order.objects.exists())
        self.assertTrue(CartItem.objects.filter(cart__user=self.user).exists())

    def test_checkout_rejects_unsupported_methods(self):
        self.authenticate()

        responses = [
            self.client.get(self.checkout_url),
            self.client.put(self.checkout_url, {}, format="json"),
            self.client.patch(self.checkout_url, {}, format="json"),
            self.client.delete(self.checkout_url),
        ]

        for response in responses:
            with self.subTest(method=response.request["REQUEST_METHOD"]):
                self.assertEqual(
                    response.status_code,
                    status.HTTP_405_METHOD_NOT_ALLOWED,
                )

    def test_checkout_rejects_missing_cart_without_creating_one(self):
        self.authenticate()

        response = self.client.post(self.checkout_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "empty_cart")
        self.assertEqual(response.data["detail"], "Your cart is empty.")
        self.assertFalse(Cart.objects.filter(user=self.user).exists())
        self.assertFalse(Order.objects.exists())

    def test_checkout_rejects_existing_empty_cart(self):
        Cart.objects.create(user=self.user)
        self.authenticate()

        response = self.client.post(self.checkout_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "empty_cart")
        self.assertFalse(Order.objects.exists())

    def test_checkout_creates_completed_order_and_expected_response(self):
        self.fill_cart(self.user, self.game)
        self.authenticate()

        response = self.client.post(self.checkout_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            set(response.data),
            {"id", "status", "total_price", "items", "created_at"},
        )
        self.assertEqual(response.data["status"], Order.Status.COMPLETED)
        self.assertEqual(response.data["total_price"], "19.99")
        self.assertEqual(len(response.data["items"]), 1)
        item = response.data["items"][0]
        self.assertEqual(set(item), {"id", "game", "price_at_purchase"})
        self.assertEqual(item["price_at_purchase"], "19.99")
        self.assertEqual(
            set(item["game"]),
            {"id", "title", "cover", "developer"},
        )
        self.assertEqual(item["game"]["id"], self.game.pk)
        self.assertEqual(
            item["game"]["cover"],
            "http://testserver/media/games/covers/2026/08/checkout-game.webp",
        )

    def test_checkout_multiple_games_calculates_total_and_snapshots_prices(self):
        self.fill_cart(self.user, self.game, self.second_game)
        self.authenticate()

        response = self.client.post(self.checkout_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["total_price"], "25.00")
        self.assertEqual(
            [item["game"]["id"] for item in response.data["items"]],
            [self.game.pk, self.second_game.pk],
        )
        self.assertEqual(
            [item["price_at_purchase"] for item in response.data["items"]],
            ["19.99", "5.01"],
        )
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.total_price, Decimal("25.00"))

    def test_checkout_clears_only_the_purchased_cart_items(self):
        own_cart = self.fill_cart(self.user, self.game)
        other_cart = self.fill_cart(self.other_user, self.second_game)
        self.authenticate()

        response = self.client.post(self.checkout_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Cart.objects.filter(pk=own_cart.pk).exists())
        self.assertFalse(CartItem.objects.filter(cart=own_cart).exists())
        self.assertTrue(
            CartItem.objects.filter(
                cart=other_cart,
                game=self.second_game,
            ).exists(),
        )

    def test_checkout_creates_library_items_linked_to_the_order(self):
        self.fill_cart(self.user, self.game, self.second_game)
        self.authenticate()

        response = self.client.post(self.checkout_url, {}, format="json")

        order = Order.objects.get(pk=response.data["id"])
        library_items = LibraryItem.objects.filter(user=self.user).order_by(
            "game_id",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            list(library_items.values_list("game_id", flat=True)),
            sorted([self.game.pk, self.second_game.pk]),
        )
        self.assertTrue(all(item.order_id == order.pk for item in library_items))

    def test_checkout_keeps_purchase_prices_after_catalog_price_changes(self):
        self.fill_cart(self.user, self.game)
        self.authenticate()
        response = self.client.post(self.checkout_url, {}, format="json")
        order = Order.objects.get(pk=response.data["id"])

        self.game.price = Decimal("99.99")
        self.game.save(update_fields=["price", "updated_at"])
        order.refresh_from_db()
        order_item = order.items.get()

        self.assertEqual(order.total_price, Decimal("19.99"))
        self.assertEqual(order_item.price_at_purchase, Decimal("19.99"))

    def test_checkout_rejects_an_already_owned_game_and_keeps_cart(self):
        existing_order = self.grant_purchase(self.user, self.game)
        cart = self.fill_cart(self.user, self.game)
        self.authenticate()

        response = self.client.post(self.checkout_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "already_owned")
        self.assertEqual(response.data["game_ids"], [self.game.pk])
        self.assertEqual(Order.objects.count(), 1)
        self.assertTrue(Order.objects.filter(pk=existing_order.pk).exists())
        self.assertTrue(CartItem.objects.filter(cart=cart, game=self.game).exists())

    def test_checkout_rejects_the_whole_mixed_cart_when_one_game_is_owned(self):
        self.grant_purchase(self.user, self.game)
        cart = self.fill_cart(self.user, self.game, self.second_game)
        self.authenticate()

        response = self.client.post(self.checkout_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "already_owned")
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(cart.items.count(), 2)
        self.assertFalse(
            LibraryItem.objects.filter(
                user=self.user,
                game=self.second_game,
            ).exists(),
        )

    def test_different_users_can_buy_the_same_game(self):
        self.fill_cart(self.user, self.game)
        self.authenticate()
        first_response = self.client.post(self.checkout_url, {}, format="json")

        self.fill_cart(self.other_user, self.game)
        self.authenticate(self.other_user)
        second_response = self.client.post(
            self.checkout_url,
            {},
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            LibraryItem.objects.filter(game=self.game).count(),
            2,
        )

    def test_checkout_uses_only_the_authenticated_users_cart(self):
        self.fill_cart(self.user, self.game)
        other_cart = self.fill_cart(self.other_user, self.second_game)
        self.authenticate()

        response = self.client.post(self.checkout_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            LibraryItem.objects.filter(
                user=self.user,
                game=self.game,
            ).exists(),
        )
        self.assertFalse(
            LibraryItem.objects.filter(
                user=self.user,
                game=self.second_game,
            ).exists(),
        )
        self.assertTrue(
            CartItem.objects.filter(
                cart=other_cart,
                game=self.second_game,
            ).exists(),
        )

    def test_second_checkout_cannot_create_a_duplicate_order(self):
        self.fill_cart(self.user, self.game)
        self.authenticate()

        first_response = self.client.post(self.checkout_url, {}, format="json")
        second_response = self.client.post(self.checkout_url, {}, format="json")

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(second_response.data["code"], "empty_cart")
        self.assertEqual(Order.objects.filter(user=self.user).count(), 1)
        self.assertEqual(OrderItem.objects.filter(order__user=self.user).count(), 1)

    def test_integrity_error_rolls_back_order_items_library_and_cart_cleanup(self):
        cart = self.fill_cart(self.user, self.game)
        self.authenticate()

        with patch(
            "store.services.LibraryItem.objects.bulk_create",
            side_effect=IntegrityError("forced ownership conflict"),
        ):
            response = self.client.post(self.checkout_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "already_owned")
        self.assertFalse(Order.objects.exists())
        self.assertFalse(OrderItem.objects.exists())
        self.assertFalse(LibraryItem.objects.exists())
        self.assertTrue(CartItem.objects.filter(cart=cart, game=self.game).exists())

    def test_zero_price_game_can_be_checked_out(self):
        free_game = Game.objects.create(
            title="Free Checkout Game",
            description="A free game.",
            price=Decimal("0.00"),
            developer="Free Studio",
            release_date=date(2026, 8, 27),
            requirements="",
        )
        self.fill_cart(self.user, free_game)
        self.authenticate()

        response = self.client.post(self.checkout_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["total_price"], "0.00")
        self.assertEqual(
            response.data["items"][0]["price_at_purchase"],
            "0.00",
        )
