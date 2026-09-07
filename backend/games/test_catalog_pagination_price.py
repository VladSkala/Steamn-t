"""API coverage for KAN-35 catalog pagination and price filtering."""

from datetime import date
from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from games.models import Game, Genre


class CatalogPaginationPriceAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.featured = Genre.objects.create(name="Featured")
        cls.games = Game.objects.bulk_create(
            [
                Game(
                    title=f"Catalog Game {index:02d}",
                    description="Catalog pagination and price fixture.",
                    price=Decimal(index),
                    developer="Pagination Studio",
                    release_date=date(2026, 9, 9),
                    requirements="",
                )
                for index in range(55)
            ],
        )
        for index, game in enumerate(cls.games):
            if index % 2 == 0:
                game.genres.add(cls.featured)
        cls.url = reverse("games:game-list")

    @staticmethod
    def titles(response):
        return [game["title"] for game in response.data["results"]]

    def test_default_and_custom_page_sizes_have_stable_contract(self):
        default_page = self.client.get(self.url)
        custom_page = self.client.get(self.url, {"page": 2, "page_size": 7})
        capped_page = self.client.get(self.url, {"page_size": 500})

        self.assertEqual(default_page.status_code, status.HTTP_200_OK)
        self.assertEqual(
            set(default_page.data),
            {"count", "next", "previous", "results"},
        )
        self.assertEqual(default_page.data["count"], 55)
        self.assertEqual(len(default_page.data["results"]), 12)
        self.assertIsNone(default_page.data["previous"])
        self.assertIsNotNone(default_page.data["next"])
        self.assertEqual(
            self.titles(default_page),
            [f"Catalog Game {index:02d}" for index in range(12)],
        )

        self.assertEqual(custom_page.status_code, status.HTTP_200_OK)
        self.assertEqual(len(custom_page.data["results"]), 7)
        self.assertIsNotNone(custom_page.data["previous"])
        self.assertIsNotNone(custom_page.data["next"])
        self.assertEqual(
            self.titles(custom_page),
            [f"Catalog Game {index:02d}" for index in range(7, 14)],
        )
        self.assertEqual(len(capped_page.data["results"]), 50)

    def test_invalid_and_out_of_range_pages_are_rejected(self):
        for page in ("invalid", "0", "-1", "999"):
            with self.subTest(page=page):
                response = self.client.get(self.url, {"page": page})
                self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_minimum_and_maximum_price_filters_are_inclusive(self):
        bounded = self.client.get(
            self.url,
            {"min_price": "10.00", "max_price": "12.00"},
        )
        minimum_only = self.client.get(self.url, {"min_price": "50.00"})
        maximum_only = self.client.get(self.url, {"max_price": "2.00"})

        self.assertEqual(bounded.status_code, status.HTTP_200_OK)
        self.assertEqual(bounded.data["count"], 3)
        self.assertEqual(
            self.titles(bounded),
            ["Catalog Game 10", "Catalog Game 11", "Catalog Game 12"],
        )
        self.assertEqual(
            self.titles(minimum_only),
            [
                "Catalog Game 50",
                "Catalog Game 51",
                "Catalog Game 52",
                "Catalog Game 53",
                "Catalog Game 54",
            ],
        )
        self.assertEqual(
            self.titles(maximum_only),
            ["Catalog Game 00", "Catalog Game 01", "Catalog Game 02"],
        )

    def test_invalid_price_bounds_are_rejected(self):
        invalid_params = (
            {"min_price": "not-a-price"},
            {"min_price": "-0.01"},
            {"max_price": "NaN"},
            {"max_price": "Infinity"},
            {"max_price": "1.999"},
            {"max_price": "999999999.00"},
        )

        for params in invalid_params:
            with self.subTest(params=params):
                response = self.client.get(self.url, params)
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertTrue(set(params).intersection(response.data))

        reversed_range = self.client.get(
            self.url,
            {"min_price": "20.00", "max_price": "10.00"},
        )
        self.assertEqual(reversed_range.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("min_price", reversed_range.data)

    def test_price_range_combines_with_genre_search_ordering_and_pagination(self):
        response = self.client.get(
            self.url,
            {
                "search": "Catalog Game 1",
                "genre": self.featured.pk,
                "min_price": "11.00",
                "max_price": "18.00",
                "ordering": "-price",
                "page": 2,
                "page_size": 2,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 4)
        self.assertEqual(
            self.titles(response),
            ["Catalog Game 14", "Catalog Game 12"],
        )
        self.assertIsNotNone(response.data["previous"])
        self.assertIsNone(response.data["next"])
