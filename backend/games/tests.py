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


class CatalogFilteringAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.rpg = Genre.objects.create(name="RPG")
        cls.adventure = Genre.objects.create(name="Adventure")
        cls.strategy = Genre.objects.create(name="Strategy")

        cls.alpha_game = Game.objects.create(
            title="Alpha Quest",
            description="An adventure with role-playing elements.",
            price=Decimal("30.00"),
            developer="Alpha Studio",
            release_date=date(2026, 1, 1),
        )
        cls.alpha_game.genres.add(cls.rpg, cls.adventure)

        cls.beta_game = Game.objects.create(
            title="Beta Quest",
            description="A compact role-playing quest.",
            price=Decimal("10.00"),
            developer="Beta Studio",
            release_date=date(2026, 2, 1),
        )
        cls.beta_game.genres.add(cls.rpg)

        cls.gamma_game = Game.objects.create(
            title="Gamma Builder",
            description="A strategy building game.",
            price=Decimal("20.00"),
            developer="Gamma Studio",
            release_date=date(2026, 3, 1),
        )
        cls.gamma_game.genres.add(cls.strategy)

        cls.delta_game = Game.objects.create(
            title="Delta Quest",
            description="An adventure beyond the horizon.",
            price=Decimal("40.00"),
            developer="Delta Studio",
            release_date=date(2026, 4, 1),
        )
        cls.delta_game.genres.add(cls.adventure)

        cls.url = reverse("games:game-list")

    @staticmethod
    def response_titles(response):
        return [game["title"] for game in response.data]

    def test_search_matches_title_case_insensitively_and_only_searches_title(self):
        response = self.client.get(self.url, {"search": "qUeSt"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            self.response_titles(response),
            ["Alpha Quest", "Beta Quest", "Delta Quest"],
        )

        developer_only_response = self.client.get(self.url, {"search": "Studio"})

        self.assertEqual(developer_only_response.status_code, status.HTTP_200_OK)
        self.assertEqual(developer_only_response.data, [])

    def test_game_list_filters_by_genre_id(self):
        response = self.client.get(self.url, {"genre": self.rpg.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            self.response_titles(response),
            ["Alpha Quest", "Beta Quest"],
        )

    def test_genre_filter_rejects_malformed_or_out_of_range_ids(self):
        invalid_values = ["not-a-number", "1.5", "0", "-1", str(2**63)]

        for invalid_value in invalid_values:
            with self.subTest(genre=invalid_value):
                response = self.client.get(self.url, {"genre": invalid_value})

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("genre", response.data)

    def test_unknown_genre_id_returns_an_empty_list(self):
        response = self.client.get(self.url, {"genre": 9_999_999})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_game_list_orders_by_price_in_both_directions(self):
        expectations = {
            "price": ["Beta Quest", "Gamma Builder", "Alpha Quest", "Delta Quest"],
            "-price": ["Delta Quest", "Alpha Quest", "Gamma Builder", "Beta Quest"],
        }

        for ordering, expected_titles in expectations.items():
            with self.subTest(ordering=ordering):
                response = self.client.get(self.url, {"ordering": ordering})

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(self.response_titles(response), expected_titles)

    def test_game_list_orders_by_title_in_both_directions(self):
        expectations = {
            "title": ["Alpha Quest", "Beta Quest", "Delta Quest", "Gamma Builder"],
            "-title": ["Gamma Builder", "Delta Quest", "Beta Quest", "Alpha Quest"],
        }

        for ordering, expected_titles in expectations.items():
            with self.subTest(ordering=ordering):
                response = self.client.get(self.url, {"ordering": ordering})

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(self.response_titles(response), expected_titles)

    def test_game_list_combines_search_genre_and_ordering(self):
        response = self.client.get(
            self.url,
            {
                "search": "quest",
                "genre": self.rpg.id,
                "ordering": "-price",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            self.response_titles(response),
            ["Alpha Quest", "Beta Quest"],
        )

    def test_unsupported_ordering_falls_back_to_default_title_order(self):
        response = self.client.get(self.url, {"ordering": "developer"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            self.response_titles(response),
            ["Alpha Quest", "Beta Quest", "Delta Quest", "Gamma Builder"],
        )


class GameDetailAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.rpg = Genre.objects.create(name="Detail RPG")
        cls.adventure = Genre.objects.create(name="Detail Adventure")
        cls.game = Game.objects.create(
            title="Detail Quest",
            description="A complete game used to verify the detail API.",
            price=Decimal("49.90"),
            cover="games/covers/2026/08/detail-quest.webp",
            developer="Detail Studio",
            release_date=date(2026, 8, 26),
            requirements=(
                "Minimum: 8 GB RAM, GTX 1060.\n"
                "Recommended: 16 GB RAM, RTX 3060."
            ),
        )
        cls.game.genres.add(cls.rpg, cls.adventure)
        cls.url = reverse("games:game-detail", kwargs={"pk": cls.game.pk})

        cls.game_without_optional_content = Game.objects.create(
            title="Bare Details",
            description="A game without a cover or requirements.",
            price=Decimal("0.00"),
            developer="Bare Studio",
            release_date=date(2025, 1, 1),
            requirements="",
        )
        cls.game_without_optional_content_url = reverse(
            "games:game-detail",
            kwargs={"pk": cls.game_without_optional_content.pk},
        )

    def test_game_detail_is_public_and_has_expected_shape(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            set(response.data),
            {
                "id",
                "title",
                "description",
                "price",
                "cover",
                "developer",
                "release_date",
                "requirements",
                "genres",
            },
        )

    def test_game_detail_returns_full_values_and_nested_genres(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.game.pk)
        self.assertEqual(response.data["title"], "Detail Quest")
        self.assertEqual(
            response.data["description"],
            "A complete game used to verify the detail API.",
        )
        self.assertEqual(response.data["price"], "49.90")
        self.assertEqual(response.data["developer"], "Detail Studio")
        self.assertEqual(response.data["release_date"], "2026-08-26")
        self.assertEqual(
            response.data["requirements"],
            "Minimum: 8 GB RAM, GTX 1060.\n"
            "Recommended: 16 GB RAM, RTX 3060.",
        )
        self.assertEqual(
            response.data["genres"],
            [
                {"id": self.adventure.pk, "name": "Detail Adventure"},
                {"id": self.rpg.pk, "name": "Detail RPG"},
            ],
        )

    def test_game_detail_returns_absolute_or_null_cover_urls(self):
        response = self.client.get(self.url)
        response_without_cover = self.client.get(
            self.game_without_optional_content_url,
        )

        self.assertEqual(
            response.data["cover"],
            "http://testserver/media/games/covers/2026/08/detail-quest.webp",
        )
        self.assertIsNone(response_without_cover.data["cover"])

    def test_game_detail_allows_blank_requirements(self):
        response = self.client.get(self.game_without_optional_content_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["requirements"], "")
        self.assertEqual(response.data["price"], "0.00")

    def test_game_detail_returns_404_for_unknown_game(self):
        missing_url = reverse("games:game-detail", kwargs={"pk": 999_999})

        response = self.client.get(missing_url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn("detail", response.data)

    def test_game_detail_rejects_write_methods(self):
        for method_name in ("post", "put", "patch", "delete"):
            with self.subTest(method=method_name):
                method = getattr(self.client, method_name)
                response = method(self.url, {}, format="json")

                self.assertEqual(
                    response.status_code,
                    status.HTTP_405_METHOD_NOT_ALLOWED,
                )

    def test_game_detail_prefetches_genres(self):
        with self.assertNumQueries(2):
            response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["genres"]), 2)

    def test_game_detail_supports_head_and_options(self):
        head_response = self.client.head(self.url)
        options_response = self.client.options(self.url)

        self.assertEqual(head_response.status_code, status.HTTP_200_OK)
        self.assertEqual(options_response.status_code, status.HTTP_200_OK)
        self.assertEqual(options_response["Allow"], "GET, HEAD, OPTIONS")
