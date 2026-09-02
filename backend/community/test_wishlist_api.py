"""API coverage for the KAN-27 personal wishlist contract."""

from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from community.models import GameWishlist
from games.models import Game, Genre


User = get_user_model()


class WishlistAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="wishlist-owner",
            email="wishlist-owner@example.com",
            password="StrongPass123!",
        )
        self.other_user = User.objects.create_user(
            username="other-wishlist-owner",
            email="other-wishlist-owner@example.com",
            password="StrongPass123!",
        )
        self.genre = Genre.objects.create(name="Adventure")
        self.first_game = self.create_game(
            title="Wishlist Adventure",
            price="19.99",
        )
        self.second_game = self.create_game(
            title="Wishlist Strategy",
            price="7.50",
        )
        self.first_game.genres.add(self.genre)
        self.list_url = reverse("community:wishlist")
        self.create_url = reverse("community:wishlist-item-create")
        self.client.force_authenticate(user=self.user)

    @staticmethod
    def create_game(*, title: str, price: str) -> Game:
        return Game.objects.create(
            title=title,
            description=f"Description for {title}.",
            price=Decimal(price),
            developer="Wishlist Studio",
            release_date=date(2026, 9, 1),
            requirements="8 GB RAM",
        )

    def delete_url(self, game: Game) -> str:
        return reverse("community:wishlist-item-delete", args=[game.pk])

    def test_wishlist_endpoints_require_authentication(self):
        self.client.force_authenticate(user=None)

        responses = (
            self.client.get(self.list_url),
            self.client.post(
                self.create_url,
                {"game_id": self.first_game.pk},
                format="json",
            ),
            self.client.delete(self.delete_url(self.first_game)),
        )

        for response in responses:
            with self.subTest(method=response.request["REQUEST_METHOD"]):
                self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(GameWishlist.objects.exists())

    def test_empty_wishlist_returns_a_stable_items_envelope(self):
        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"items": []})

    def test_user_can_add_an_unowned_catalog_game(self):
        response = self.client.post(
            self.create_url,
            {"game_id": self.first_game.pk},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        item = GameWishlist.objects.get(user=self.user, game=self.first_game)
        self.assertEqual(response.data["id"], item.pk)
        self.assertEqual(response.data["game"]["id"], self.first_game.pk)
        self.assertEqual(response.data["game"]["title"], self.first_game.title)
        self.assertEqual(response.data["game"]["price"], "19.99")
        self.assertEqual(response.data["game"]["cover"], None)
        self.assertEqual(
            response.data["game"]["genres"],
            [{"id": self.genre.pk, "name": self.genre.name}],
        )
        self.assertIn("created_at", response.data)

    def test_list_is_owner_scoped_and_newest_first(self):
        GameWishlist.objects.create(
            user=self.other_user,
            game=self.first_game,
        )
        first_item = GameWishlist.objects.create(
            user=self.user,
            game=self.first_game,
        )
        second_item = GameWishlist.objects.create(
            user=self.user,
            game=self.second_game,
        )

        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in response.data["items"]],
            [second_item.pk, first_item.pk],
        )
        self.assertEqual(
            [item["game"]["id"] for item in response.data["items"]],
            [self.second_game.pk, self.first_game.pk],
        )

    def test_duplicate_game_is_rejected_without_creating_another_item(self):
        first_response = self.client.post(
            self.create_url,
            {"game_id": self.first_game.pk},
            format="json",
        )
        duplicate_response = self.client.post(
            self.create_url,
            {"game_id": self.first_game.pk},
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            duplicate_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            str(duplicate_response.data["game_id"][0]),
            "This game is already in your wishlist.",
        )
        self.assertEqual(
            GameWishlist.objects.filter(
                user=self.user,
                game=self.first_game,
            ).count(),
            1,
        )

    def test_missing_and_unknown_game_ids_are_rejected(self):
        responses = (
            self.client.post(self.create_url, {}, format="json"),
            self.client.post(
                self.create_url,
                {"game_id": 999999},
                format="json",
            ),
        )

        for response in responses:
            with self.subTest(response=response.data):
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("game_id", response.data)
        self.assertFalse(GameWishlist.objects.exists())

    def test_integrity_conflict_is_reported_as_a_validation_error(self):
        with patch(
            "community.serializers.GameWishlist.objects.create",
            side_effect=IntegrityError("concurrent duplicate"),
        ):
            response = self.client.post(
                self.create_url,
                {"game_id": self.first_game.pk},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            str(response.data["game_id"][0]),
            "This game is already in your wishlist.",
        )
        self.assertFalse(GameWishlist.objects.exists())

    def test_delete_removes_only_the_authenticated_users_item(self):
        GameWishlist.objects.create(
            user=self.user,
            game=self.first_game,
        )
        other_item = GameWishlist.objects.create(
            user=self.other_user,
            game=self.first_game,
        )

        response = self.client.delete(self.delete_url(self.first_game))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            GameWishlist.objects.filter(
                user=self.user,
                game=self.first_game,
            ).exists(),
        )
        self.assertTrue(GameWishlist.objects.filter(pk=other_item.pk).exists())

    def test_delete_cannot_access_another_users_item(self):
        other_item = GameWishlist.objects.create(
            user=self.other_user,
            game=self.second_game,
        )

        response = self.client.delete(self.delete_url(self.second_game))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(GameWishlist.objects.filter(pk=other_item.pk).exists())

    def test_delete_missing_item_returns_not_found(self):
        response = self.client.delete(self.delete_url(self.first_game))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_wishlist_routes_reject_unsupported_methods(self):
        responses = (
            self.client.post(self.list_url, {}, format="json"),
            self.client.get(self.create_url),
            self.client.get(self.delete_url(self.first_game)),
            self.client.post(
                self.delete_url(self.first_game),
                {},
                format="json",
            ),
        )

        for response in responses:
            with self.subTest(method=response.request["REQUEST_METHOD"]):
                self.assertEqual(
                    response.status_code,
                    status.HTTP_405_METHOD_NOT_ALLOWED,
                )
