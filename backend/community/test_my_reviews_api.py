from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.test import APITestCase

from community.models import GameReview
from games.models import Game


User = get_user_model()


class MyReviewsAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="my-reviews-owner",
            email="my-reviews-owner@example.com",
        )
        self.other_user = User.objects.create_user(
            username="other-review-owner",
            email="other-review-owner@example.com",
        )
        self.url = reverse("community:my-reviews")

    @staticmethod
    def create_game(title: str) -> Game:
        return Game.objects.create(
            title=title,
            description=f"Description for {title}.",
            price=Decimal("19.99"),
            developer="My Reviews Studio",
            release_date=date(2026, 9, 7),
            requirements="8 GB RAM",
        )

    def create_review(self, user, title, rating=5) -> GameReview:
        return GameReview.objects.create(
            user=user,
            game=self.create_game(title),
            rating=rating,
            body=f"Review for {title}.",
        )

    def test_authentication_is_required(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_empty_response_uses_stable_page_number_contract(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data,
            {
                "count": 0,
                "next": None,
                "previous": None,
                "results": [],
            },
        )

    def test_response_contains_game_review_text_rating_and_dates(self):
        review = self.create_review(self.user, "Nested Review Game", rating=4)
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        item = response.data["results"][0]
        self.assertEqual(
            set(item),
            {
                "id",
                "game",
                "rating",
                "body",
                "images",
                "created_at",
                "updated_at",
            },
        )
        self.assertEqual(item["id"], review.pk)
        self.assertEqual(item["rating"], 4)
        self.assertEqual(item["body"], "Review for Nested Review Game.")
        self.assertEqual(
            item["game"],
            {
                "id": review.game_id,
                "title": "Nested Review Game",
                "cover": None,
                "developer": "My Reviews Studio",
            },
        )
        self.assertEqual(item["images"], [])
        self.assertIsNotNone(parse_datetime(item["created_at"]))
        self.assertIsNotNone(parse_datetime(item["updated_at"]))

    def test_only_current_users_reviews_are_returned(self):
        older = self.create_review(self.user, "Owned Older")
        newest = self.create_review(self.user, "Owned Newest")
        foreign = self.create_review(self.other_user, "Foreign Review")
        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            self.url,
            {"user_id": self.other_user.pk},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(
            [item["id"] for item in response.data["results"]],
            [newest.pk, older.pk],
        )
        self.assertNotIn(foreign.pk, [item["id"] for item in response.data["results"]])

    def test_default_and_maximum_page_sizes_are_enforced(self):
        games = Game.objects.bulk_create(
            [
                Game(
                    title=f"Pagination Game {index:02d}",
                    description="Pagination fixture.",
                    price=Decimal("1.00"),
                    developer="Pagination Studio",
                    release_date=date(2026, 9, 7),
                    requirements="",
                )
                for index in range(55)
            ],
        )
        reviews = GameReview.objects.bulk_create(
            [
                GameReview(
                    user=self.user,
                    game=game,
                    rating=(index % 5) + 1,
                    body=f"Pagination review {index}.",
                )
                for index, game in enumerate(games)
            ],
        )
        self.client.force_authenticate(user=self.user)

        default_page = self.client.get(self.url)
        capped_page = self.client.get(self.url, {"page_size": 500})
        second_capped_page = self.client.get(
            self.url,
            {"page": 2, "page_size": 500},
        )

        expected_ids = [review.pk for review in reversed(reviews)]
        self.assertEqual(default_page.data["count"], 55)
        self.assertEqual(len(default_page.data["results"]), 10)
        self.assertEqual(
            [item["id"] for item in default_page.data["results"]],
            expected_ids[:10],
        )
        self.assertEqual(len(capped_page.data["results"]), 50)
        self.assertEqual(len(second_capped_page.data["results"]), 5)

    def test_prefetch_keeps_query_count_bounded(self):
        for index in range(4):
            self.create_review(self.user, f"Query Game {index}")
        self.client.force_authenticate(user=self.user)

        with self.assertNumQueries(3):
            response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 4)

    def test_endpoint_is_read_only(self):
        self.client.force_authenticate(user=self.user)

        responses = (
            self.client.post(self.url, {}, format="json"),
            self.client.put(self.url, {}, format="json"),
            self.client.patch(self.url, {}, format="json"),
            self.client.delete(self.url),
        )

        for response in responses:
            with self.subTest(method=response.request["REQUEST_METHOD"]):
                self.assertEqual(
                    response.status_code,
                    status.HTTP_405_METHOD_NOT_ALLOWED,
                )
