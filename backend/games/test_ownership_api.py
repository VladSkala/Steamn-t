from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from games.models import Game
from store.models import LibraryItem, Order


User = get_user_model()


class GameOwnershipAPITests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="catalog-owner",
            email="catalog-owner@example.com",
            password="safe-test-password",
        )
        self.other_user = User.objects.create_user(
            username="catalog-other",
            email="catalog-other@example.com",
            password="safe-test-password",
        )
        self.owned_game = Game.objects.create(
            title="Owned Catalog Game",
            description="Owned game.",
            price=Decimal("19.99"),
            developer="Owner Studio",
            release_date=date(2026, 9, 1),
        )
        self.unowned_game = Game.objects.create(
            title="Unowned Catalog Game",
            description="Unowned game.",
            price=Decimal("9.99"),
            developer="Catalog Studio",
            release_date=date(2026, 9, 2),
        )
        order = Order.objects.create(
            user=self.owner,
            total_price=self.owned_game.price,
            status=Order.Status.COMPLETED,
        )
        LibraryItem.objects.create(
            user=self.owner,
            game=self.owned_game,
            order=order,
        )

    def test_anonymous_catalog_reports_games_as_unowned(self):
        response = self.client.get(reverse("games:game-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(all(game["is_owned"] is False for game in response.data))

    def test_authenticated_catalog_marks_only_the_users_owned_game(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.get(reverse("games:game-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        games = {game["id"]: game for game in response.data}
        self.assertTrue(games[self.owned_game.pk]["is_owned"])
        self.assertFalse(games[self.unowned_game.pk]["is_owned"])

    def test_detail_ownership_is_user_specific(self):
        url = reverse("games:game-detail", kwargs={"pk": self.owned_game.pk})

        self.client.force_authenticate(user=self.owner)
        owner_response = self.client.get(url)
        self.client.force_authenticate(user=self.other_user)
        other_response = self.client.get(url)

        self.assertEqual(owner_response.status_code, status.HTTP_200_OK)
        self.assertEqual(other_response.status_code, status.HTTP_200_OK)
        self.assertTrue(owner_response.data["is_owned"])
        self.assertFalse(other_response.data["is_owned"])
