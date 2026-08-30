"""End-to-end API coverage for the cart-to-checkout flow."""

from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from games.models import Game
from store.models import CartItem, LibraryItem, Order, OrderItem


User = get_user_model()


class CheckoutIntegrationAPITests(APITestCase):
    """Verify cart and checkout endpoints as one authenticated workflow."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="checkout-integration-owner",
            email="checkout-integration@example.com",
            password="safe-test-password",
        )
        self.first_game = Game.objects.create(
            title="Integration Game One",
            description="The first game in the checkout integration test.",
            price=Decimal("19.99"),
            developer="Integration Studio",
            release_date=date(2026, 8, 30),
            requirements="8 GB RAM",
        )
        self.second_game = Game.objects.create(
            title="Integration Game Two",
            description="The second game in the checkout integration test.",
            price=Decimal("5.01"),
            developer="Integration Studio",
            release_date=date(2026, 8, 30),
            requirements="4 GB RAM",
        )
        self.cart_url = reverse("store:cart")
        self.cart_items_url = reverse("store:cart-item-create")
        self.checkout_url = reverse("store:order-checkout")
        self.client.force_authenticate(user=self.user)

    def add_game_to_cart(self, game):
        response = self.client.post(
            self.cart_items_url,
            {"game_id": game.pk},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response

    def test_complete_multi_game_checkout_flow_through_public_api(self):
        self.add_game_to_cart(self.first_game)
        self.add_game_to_cart(self.second_game)

        cart_before_checkout = self.client.get(self.cart_url)
        self.assertEqual(cart_before_checkout.status_code, status.HTTP_200_OK)
        self.assertEqual(cart_before_checkout.data["total"], "25.00")
        self.assertCountEqual(
            [
                item["game"]["id"]
                for item in cart_before_checkout.data["items"]
            ],
            [self.first_game.pk, self.second_game.pk],
        )

        checkout_response = self.client.post(
            self.checkout_url,
            {},
            format="json",
        )

        self.assertEqual(
            checkout_response.status_code,
            status.HTTP_201_CREATED,
        )
        self.assertEqual(checkout_response.data["status"], "completed")
        self.assertEqual(checkout_response.data["total_price"], "25.00")
        self.assertCountEqual(
            [item["game"]["id"] for item in checkout_response.data["items"]],
            [self.first_game.pk, self.second_game.pk],
        )

        order = Order.objects.get(
            pk=checkout_response.data["id"],
            user=self.user,
        )
        self.assertEqual(order.total_price, Decimal("25.00"))
        self.assertSetEqual(
            set(
                OrderItem.objects.filter(order=order).values_list(
                    "game_id",
                    flat=True,
                ),
            ),
            {self.first_game.pk, self.second_game.pk},
        )
        self.assertSetEqual(
            set(
                LibraryItem.objects.filter(user=self.user).values_list(
                    "game_id",
                    flat=True,
                ),
            ),
            {self.first_game.pk, self.second_game.pk},
        )

        cart_after_checkout = self.client.get(self.cart_url)
        self.assertEqual(cart_after_checkout.status_code, status.HTTP_200_OK)
        self.assertEqual(cart_after_checkout.data["items"], [])
        self.assertEqual(cart_after_checkout.data["total"], "0.00")
        self.assertFalse(CartItem.objects.filter(cart__user=self.user).exists())

    def test_checkout_rejects_empty_cart_through_public_api(self):
        cart_response = self.client.get(self.cart_url)
        self.assertEqual(cart_response.status_code, status.HTTP_200_OK)
        self.assertEqual(cart_response.data["items"], [])

        checkout_response = self.client.post(
            self.checkout_url,
            {},
            format="json",
        )

        self.assertEqual(
            checkout_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(checkout_response.data["code"], "empty_cart")
        self.assertFalse(Order.objects.filter(user=self.user).exists())
        self.assertFalse(OrderItem.objects.filter(order__user=self.user).exists())
        self.assertFalse(LibraryItem.objects.filter(user=self.user).exists())

    def test_checkout_rejects_repeat_purchase_through_public_api(self):
        self.add_game_to_cart(self.first_game)
        first_checkout = self.client.post(
            self.checkout_url,
            {},
            format="json",
        )
        self.assertEqual(first_checkout.status_code, status.HTTP_201_CREATED)

        self.add_game_to_cart(self.first_game)
        repeat_checkout = self.client.post(
            self.checkout_url,
            {},
            format="json",
        )

        self.assertEqual(
            repeat_checkout.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(repeat_checkout.data["code"], "already_owned")
        self.assertEqual(repeat_checkout.data["game_ids"], [self.first_game.pk])
        self.assertEqual(Order.objects.filter(user=self.user).count(), 1)
        self.assertEqual(OrderItem.objects.filter(order__user=self.user).count(), 1)
        self.assertEqual(LibraryItem.objects.filter(user=self.user).count(), 1)
        self.assertTrue(
            CartItem.objects.filter(
                cart__user=self.user,
                game=self.first_game,
            ).exists(),
        )
