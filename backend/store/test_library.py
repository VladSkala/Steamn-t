"""API coverage for the authenticated user's purchased-game library."""

from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.test import APITestCase

from games.models import Game
from store.models import LibraryItem, Order, OrderItem


User = get_user_model()


class LibraryAPITests(APITestCase):
    """Verify the library response contract and owner isolation."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="library-owner",
            email="library-owner@example.com",
            password="safe-test-password",
        )
        self.other_user = User.objects.create_user(
            username="other-library-owner",
            email="other-library-owner@example.com",
            password="safe-test-password",
        )
        self.game = Game.objects.create(
            title="Library Game",
            description="A purchased game returned by the library API.",
            price=Decimal("49.99"),
            cover="games/covers/2026/08/library-game.webp",
            developer="Library Studio",
            release_date=date(2026, 8, 30),
            requirements="8 GB RAM",
        )
        self.other_game = Game.objects.create(
            title="Other Library Game",
            description="A game purchased by a different user.",
            price=Decimal("14.50"),
            developer="Other Studio",
            release_date=date(2026, 8, 29),
            requirements="4 GB RAM",
        )
        self.library_url = reverse("store:library")

    @staticmethod
    def grant_purchase(user, game, purchase_price=None):
        price = purchase_price if purchase_price is not None else game.price
        order = Order.objects.create(
            user=user,
            total_price=price,
            status=Order.Status.COMPLETED,
        )
        OrderItem.objects.create(
            order=order,
            game=game,
            price_at_purchase=price,
        )
        return LibraryItem.objects.create(
            user=user,
            game=game,
            order=order,
        )

    def authenticate(self, user=None):
        self.client.force_authenticate(user=user or self.user)

    def test_library_requires_authentication(self):
        response = self.client.get(self.library_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_library_returns_empty_items_for_user_without_purchases(self):
        self.authenticate()

        response = self.client.get(self.library_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"items": []})

    def test_library_returns_purchase_details_and_stable_price(self):
        library_item = self.grant_purchase(
            self.user,
            self.game,
            purchase_price=Decimal("19.99"),
        )
        self.game.price = Decimal("79.99")
        self.game.save(update_fields=["price", "updated_at"])
        self.authenticate()

        response = self.client.get(self.library_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(set(response.data), {"items"})
        self.assertEqual(len(response.data["items"]), 1)

        item = response.data["items"][0]
        self.assertEqual(
            set(item),
            {"id", "game", "price_at_purchase", "purchased_at"},
        )
        self.assertEqual(item["id"], library_item.pk)
        self.assertEqual(item["price_at_purchase"], "19.99")
        self.assertEqual(
            parse_datetime(item["purchased_at"]),
            library_item.purchased_at,
        )
        self.assertEqual(
            set(item["game"]),
            {"id", "title", "cover", "developer"},
        )
        self.assertEqual(item["game"]["id"], self.game.pk)
        self.assertEqual(item["game"]["title"], "Library Game")
        self.assertEqual(item["game"]["developer"], "Library Studio")
        self.assertEqual(
            item["game"]["cover"],
            "http://testserver/media/games/covers/2026/08/library-game.webp",
        )

    def test_library_returns_only_the_authenticated_users_items(self):
        own_item = self.grant_purchase(self.user, self.game)
        other_item = self.grant_purchase(self.other_user, self.other_game)

        self.authenticate(self.user)
        own_response = self.client.get(self.library_url)

        self.authenticate(self.other_user)
        other_response = self.client.get(self.library_url)

        self.assertEqual(own_response.status_code, status.HTTP_200_OK)
        self.assertEqual(other_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in own_response.data["items"]],
            [own_item.pk],
        )
        self.assertEqual(
            [item["id"] for item in other_response.data["items"]],
            [other_item.pk],
        )

    def test_library_rejects_write_methods(self):
        self.grant_purchase(self.user, self.game)
        self.authenticate()

        responses = [
            self.client.post(self.library_url, {}, format="json"),
            self.client.put(self.library_url, {}, format="json"),
            self.client.patch(self.library_url, {}, format="json"),
            self.client.delete(self.library_url),
        ]

        for response in responses:
            with self.subTest(method=response.request["REQUEST_METHOD"]):
                self.assertEqual(
                    response.status_code,
                    status.HTTP_405_METHOD_NOT_ALLOWED,
                )

        self.assertEqual(LibraryItem.objects.filter(user=self.user).count(), 1)
