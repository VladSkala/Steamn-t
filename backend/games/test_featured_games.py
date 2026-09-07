"""API and admin coverage for KAN-37 featured games."""

from datetime import date
from decimal import Decimal

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from games.admin import GameAdmin
from games.models import Game, Genre
from games.views import FEATURED_GAME_LIMIT
from store.models import LibraryItem, Order


User = get_user_model()


class FeaturedGameModelAdminTests(TestCase):
    def test_featured_flag_defaults_to_false_and_is_indexed(self):
        game = Game.objects.create(
            title="Default Featured Flag",
            description="Model default coverage.",
            price=Decimal("10.00"),
            developer="Admin Studio",
            release_date=date(2026, 9, 7),
        )

        self.assertFalse(game.is_featured)
        self.assertTrue(Game._meta.get_field("is_featured").db_index)

    def test_featured_flag_is_manageable_from_game_admin_list(self):
        game_admin = GameAdmin(Game, admin.site)

        self.assertIn("is_featured", game_admin.list_display)
        self.assertIn("is_featured", game_admin.list_filter)
        self.assertIn("is_featured", game_admin.list_editable)


class FeaturedGameAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.genre = Genre.objects.create(name="Featured Adventure")
        cls.featured_games = []
        for index in range(FEATURED_GAME_LIMIT + 2):
            game = Game.objects.create(
                title=f"Featured Game {index:02d}",
                description="Featured endpoint fixture.",
                price=Decimal(index + 1),
                developer="Featured Studio",
                release_date=date(2026, 9, 7),
                is_featured=True,
            )
            game.genres.add(cls.genre)
            cls.featured_games.append(game)

        cls.hidden_game = Game.objects.create(
            title="A Hidden Game",
            description="This game must not appear in the featured response.",
            price=Decimal("99.00"),
            developer="Hidden Studio",
            release_date=date(2026, 9, 7),
            is_featured=False,
        )
        cls.url = reverse("games:featured-game-list")

    def test_featured_endpoint_is_public_unpaginated_and_limited(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertEqual(len(response.data), FEATURED_GAME_LIMIT)
        self.assertEqual(
            [game["title"] for game in response.data],
            [f"Featured Game {index:02d}" for index in range(FEATURED_GAME_LIMIT)],
        )
        self.assertNotIn(self.hidden_game.pk, [game["id"] for game in response.data])
        self.assertTrue(all(game["is_owned"] is False for game in response.data))

    def test_query_params_cannot_expand_the_featured_selection(self):
        response = self.client.get(
            self.url,
            {"page": 2, "page_size": 50, "search": "Hidden"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), FEATURED_GAME_LIMIT)
        self.assertEqual(response.data[0]["title"], "Featured Game 00")

    def test_featured_endpoint_returns_empty_list_when_admin_selected_none(self):
        Game.objects.filter(is_featured=True).update(is_featured=False)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_featured_endpoint_preserves_user_specific_ownership(self):
        user = User.objects.create_user(
            username="featured-owner",
            email="featured-owner@example.com",
            password="safe-test-password",
        )
        owned_game = self.featured_games[0]
        order = Order.objects.create(
            user=user,
            total_price=owned_game.price,
            status=Order.Status.COMPLETED,
        )
        LibraryItem.objects.create(user=user, game=owned_game, order=order)
        self.client.force_authenticate(user=user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        games = {game["id"]: game for game in response.data}
        self.assertTrue(games[owned_game.pk]["is_owned"])
        self.assertTrue(
            all(
                not game["is_owned"]
                for game_id, game in games.items()
                if game_id != owned_game.pk
            ),
        )

    def test_featured_endpoint_uses_bounded_query_count(self):
        with self.assertNumQueries(2):
            response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), FEATURED_GAME_LIMIT)

    def test_featured_endpoint_rejects_write_methods(self):
        for method_name in ("post", "put", "patch", "delete"):
            with self.subTest(method=method_name):
                method = getattr(self.client, method_name)
                response = method(self.url, {}, format="json")

                self.assertEqual(
                    response.status_code,
                    status.HTTP_405_METHOD_NOT_ALLOWED,
                )

    def test_featured_endpoint_supports_head_and_options(self):
        head_response = self.client.head(self.url)
        options_response = self.client.options(self.url)

        self.assertEqual(head_response.status_code, status.HTTP_200_OK)
        self.assertEqual(options_response.status_code, status.HTTP_200_OK)
        self.assertEqual(options_response["Allow"], "GET, HEAD, OPTIONS")
