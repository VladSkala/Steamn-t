"""Cross-app API coverage for the complete KAN-26 MVP journey."""

from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from games.models import Game, Genre
from store.models import CartItem, LibraryItem, Order, OrderItem


User = get_user_model()


class CoreMVPJourneyAPITests(APITestCase):
    """Exercise the public API exactly as the frontend's core flow does."""

    password = "Strong-mvp-journey-password-2026!"

    def setUp(self):
        self.genre = Genre.objects.create(name="MVP Adventure")
        self.game = Game.objects.create(
            title="MVP Journey Game",
            description="A catalog fixture for the complete MVP API journey.",
            price=Decimal("24.99"),
            developer="Integration Studio",
            release_date=date(2026, 9, 1),
            requirements="8 GB RAM",
        )
        self.game.genres.add(self.genre)

        self.register_url = reverse("users:register")
        self.login_url = reverse("users:token")
        self.profile_url = reverse("users:profile")
        self.games_url = reverse("games:game-list")
        self.cart_url = reverse("store:cart")
        self.cart_items_url = reverse("store:cart-item-create")
        self.checkout_url = reverse("store:order-checkout")
        self.library_url = reverse("store:library")

    def test_register_login_catalog_cart_checkout_library_and_profile(self):
        register_response = self.client.post(
            self.register_url,
            {
                "username": "mvp-player",
                "email": "MVP.Player@Example.com",
                "first_name": "MVP",
                "last_name": "Player",
                "password": self.password,
                "password_confirm": self.password,
            },
            format="json",
        )

        self.assertEqual(register_response.status_code, status.HTTP_201_CREATED)
        self.assertIn("access", register_response.data)
        self.assertIn("refresh", register_response.data)
        self.assertEqual(
            register_response.data["user"]["email"],
            "mvp.player@example.com",
        )
        user_id = register_response.data["user"]["id"]

        self.client.credentials()
        login_response = self.client.post(
            self.login_url,
            {
                "email": "MVP.PLAYER@EXAMPLE.COM",
                "password": self.password,
            },
            format="json",
        )

        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertEqual(login_response.data["user"]["id"], user_id)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}"
        )

        initial_profile = self.client.get(self.profile_url)
        self.assertEqual(initial_profile.status_code, status.HTTP_200_OK)
        self.assertEqual(initial_profile.data["stats"]["library_games"], 0)

        catalog_response = self.client.get(
            self.games_url,
            {
                "search": "journey",
                "genre": self.genre.pk,
                "ordering": "price",
            },
        )
        self.assertEqual(catalog_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(catalog_response.data), 1)
        self.assertEqual(catalog_response.data[0]["id"], self.game.pk)

        add_response = self.client.post(
            self.cart_items_url,
            {"game_id": self.game.pk},
            format="json",
        )
        self.assertEqual(add_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(add_response.data["total"], "24.99")
        self.assertEqual(add_response.data["items"][0]["game"]["id"], self.game.pk)

        cart_response = self.client.get(self.cart_url)
        self.assertEqual(cart_response.status_code, status.HTTP_200_OK)
        self.assertEqual(cart_response.data["total"], "24.99")
        self.assertEqual(len(cart_response.data["items"]), 1)

        checkout_response = self.client.post(self.checkout_url, {}, format="json")
        self.assertEqual(checkout_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(checkout_response.data["status"], "completed")
        self.assertEqual(checkout_response.data["total_price"], "24.99")
        self.assertEqual(
            checkout_response.data["items"][0]["price_at_purchase"],
            "24.99",
        )

        user = User.objects.get(pk=user_id)
        order = Order.objects.get(pk=checkout_response.data["id"], user=user)
        order_item = OrderItem.objects.get(order=order, game=self.game)
        library_item = LibraryItem.objects.get(user=user, game=self.game)
        self.assertEqual(order.total_price, Decimal("24.99"))
        self.assertEqual(order_item.price_at_purchase, Decimal("24.99"))
        self.assertEqual(library_item.order, order)
        self.assertFalse(CartItem.objects.filter(cart__user=user).exists())

        empty_cart_response = self.client.get(self.cart_url)
        self.assertEqual(empty_cart_response.status_code, status.HTTP_200_OK)
        self.assertEqual(empty_cart_response.data["items"], [])
        self.assertEqual(empty_cart_response.data["total"], "0.00")

        self.game.price = Decimal("59.99")
        self.game.save(update_fields=["price"])

        library_response = self.client.get(self.library_url)
        self.assertEqual(library_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(library_response.data["items"]), 1)
        self.assertEqual(
            library_response.data["items"][0]["game"]["id"],
            self.game.pk,
        )
        self.assertEqual(
            library_response.data["items"][0]["price_at_purchase"],
            "24.99",
        )
        self.assertIn("purchased_at", library_response.data["items"][0])

        profile_response = self.client.patch(
            self.profile_url,
            {"first_name": "Integrated", "last_name": "Player"},
            format="json",
        )
        self.assertEqual(profile_response.status_code, status.HTTP_200_OK)
        self.assertEqual(profile_response.data["display_name"], "Integrated Player")
        self.assertEqual(profile_response.data["stats"]["library_games"], 1)
        self.assertNotIn("orders", profile_response.data)
