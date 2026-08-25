from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from games.models import Game, Genre


class GenreModelTests(TestCase):
    def test_genre_string_representation(self):
        genre = Genre.objects.create(name="Action")

        self.assertEqual(str(genre), "Action")


class GameModelTests(TestCase):
    def setUp(self):
        self.genre = Genre.objects.create(name="RPG")
        self.game = Game.objects.create(
            title="Model Test Game",
            description="A game used to verify the core model.",
            price=Decimal("19.99"),
            developer="Steamn't Team",
            release_date=date(2026, 8, 24),
            requirements="Test requirements",
        )

    def test_game_can_have_multiple_genres(self):
        second_genre = Genre.objects.create(name="Adventure")
        self.game.genres.add(self.genre, second_genre)

        self.assertCountEqual(
            self.game.genres.values_list("name", flat=True),
            ["RPG", "Adventure"],
        )

    def test_game_string_representation(self):
        self.assertEqual(str(self.game), "Model Test Game")

    def test_negative_price_fails_model_validation(self):
        self.game.price = Decimal("-0.01")

        with self.assertRaises(ValidationError):
            self.game.full_clean()


class CatalogAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.rpg = Genre.objects.create(name="RPG")
        cls.adventure = Genre.objects.create(name="Adventure")

        cls.alpha_game = Game.objects.create(
            title="Alpha Quest",
            description="An open-world adventure used to verify the catalog API.",
            price=Decimal("9.50"),
            cover="games/covers/2026/08/alpha-quest.webp",
            developer="Alpha Studio",
            release_date=date(2026, 1, 10),
            requirements="Not part of the KAN-10 list response.",
        )
        cls.alpha_game.genres.add(cls.rpg, cls.adventure)

        cls.beta_game = Game.objects.create(
            title="Beta Racer",
            description="A racing game without a cover.",
            price=Decimal("24.00"),
            developer="Beta Works",
            release_date=date(2025, 12, 1),
            requirements="Not part of the KAN-10 list response.",
        )
        cls.beta_game.genres.add(cls.adventure)

    def test_game_list_is_public_ordered_and_has_expected_shape(self):
        response = self.client.get(reverse("games:game-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertEqual(
            [game["title"] for game in response.data],
            ["Alpha Quest", "Beta Racer"],
        )

        first_game = response.data[0]
        self.assertEqual(
            set(first_game),
            {
                "id",
                "title",
                "description",
                "price",
                "cover",
                "developer",
                "release_date",
                "genres",
            },
        )
        self.assertEqual(first_game["price"], "9.50")
        self.assertEqual(first_game["developer"], "Alpha Studio")
        self.assertEqual(first_game["release_date"], "2026-01-10")
        self.assertEqual(
            [genre["name"] for genre in first_game["genres"]],
            ["Adventure", "RPG"],
        )
        self.assertNotIn("requirements", first_game)

    def test_game_list_returns_absolute_or_null_cover_urls(self):
        response = self.client.get(reverse("games:game-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        games_by_title = {game["title"]: game for game in response.data}
        self.assertEqual(
            games_by_title["Alpha Quest"]["cover"],
            "http://testserver/media/games/covers/2026/08/alpha-quest.webp",
        )
        self.assertIsNone(games_by_title["Beta Racer"]["cover"])

    def test_genre_list_is_public_ordered_and_has_expected_shape(self):
        response = self.client.get(reverse("games:genre-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data,
            [
                {"id": self.adventure.id, "name": "Adventure"},
                {"id": self.rpg.id, "name": "RPG"},
            ],
        )

    def test_game_list_rejects_post(self):
        response = self.client.post(reverse("games:game-list"), {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_genre_list_rejects_post(self):
        response = self.client.post(reverse("games:genre-list"), {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_game_list_prefetches_genres(self):
        with self.assertNumQueries(2):
            response = self.client.get(reverse("games:game-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
