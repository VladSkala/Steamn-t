from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase

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
