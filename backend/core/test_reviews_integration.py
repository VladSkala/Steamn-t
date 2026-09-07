"""End-to-end API coverage for the KAN-34 Reviews integration flow."""

from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from community.models import GameReview
from games.models import Game
from store.models import LibraryItem, Order, OrderItem


User = get_user_model()


class ReviewsIntegrationAPITests(APITestCase):
    """Verify Reviews, ratings and My Reviews as one owner-scoped workflow."""

    def setUp(self):
        self.first_user = User.objects.create_user(
            username="reviews-integration-one",
            email="reviews-integration-one@example.com",
            password="safe-test-password",
        )
        self.second_user = User.objects.create_user(
            username="reviews-integration-two",
            email="reviews-integration-two@example.com",
            password="safe-test-password",
        )
        self.game = Game.objects.create(
            title="Reviews Integration Game",
            description="A game used to verify the complete Reviews flow.",
            price=Decimal("24.99"),
            developer="Integration Studio",
            release_date=date(2026, 9, 8),
            requirements="8 GB RAM",
        )
        self.grant_game(self.first_user)
        self.grant_game(self.second_user)
        self.reviews_url = reverse(
            "community:game-review-list",
            kwargs={"game_id": self.game.pk},
        )
        self.first_library_review_url = reverse(
            "community:game-review",
            kwargs={"game_id": self.game.pk},
        )
        self.my_reviews_url = reverse("community:my-reviews")
        self.game_detail_url = reverse(
            "games:game-detail",
            kwargs={"pk": self.game.pk},
        )

    def grant_game(self, user):
        order = Order.objects.create(
            user=user,
            total_price=self.game.price,
            status=Order.Status.COMPLETED,
        )
        OrderItem.objects.create(
            order=order,
            game=self.game,
            price_at_purchase=self.game.price,
        )
        LibraryItem.objects.create(user=user, game=self.game, order=order)

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def create_review(self, user, *, rating=5, body="Integration review."):
        self.authenticate(user)
        return self.client.post(
            self.reviews_url,
            {"rating": rating, "body": body},
            format="json",
        )

    def review_detail_url(self, review_id):
        return reverse(
            "community:game-review-detail",
            kwargs={"game_id": self.game.pk, "review_id": review_id},
        )

    def assert_public_rating(self, *, average, count, distribution):
        reviews = self.client.get(self.reviews_url)
        game_detail = self.client.get(self.game_detail_url)

        self.assertEqual(reviews.status_code, status.HTTP_200_OK)
        self.assertEqual(reviews.data["average_rating"], average)
        self.assertEqual(reviews.data["review_count"], count)
        self.assertEqual(reviews.data["rating_distribution"], distribution)
        self.assertEqual(game_detail.status_code, status.HTTP_200_OK)
        self.assertEqual(game_detail.data["average_rating"], average)
        self.assertEqual(game_detail.data["review_count"], count)
        return reviews

    def test_create_edit_delete_stays_consistent_across_every_review_surface(self):
        created = self.create_review(
            self.first_user,
            rating=5,
            body="The original integration review.",
        )
        review_id = created.data["id"]

        public_after_create = self.assert_public_rating(
            average="5.00",
            count=1,
            distribution={"1": 0, "2": 0, "3": 0, "4": 0, "5": 1},
        )
        my_after_create = self.client.get(self.my_reviews_url)

        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(public_after_create.data["viewer_review"]["id"], review_id)
        self.assertEqual(my_after_create.status_code, status.HTTP_200_OK)
        self.assertEqual(my_after_create.data["count"], 1)
        self.assertEqual(my_after_create.data["results"][0]["id"], review_id)
        self.assertEqual(
            my_after_create.data["results"][0]["game"]["id"],
            self.game.pk,
        )

        updated = self.client.patch(
            self.review_detail_url(review_id),
            {"rating": 3, "body": "The edited integration review."},
            format="json",
        )
        public_after_edit = self.assert_public_rating(
            average="3.00",
            count=1,
            distribution={"1": 0, "2": 0, "3": 1, "4": 0, "5": 0},
        )
        my_after_edit = self.client.get(self.my_reviews_url)

        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data["rating"], 3)
        self.assertEqual(updated.data["body"], "The edited integration review.")
        self.assertEqual(public_after_edit.data["viewer_review"]["rating"], 3)
        self.assertEqual(my_after_edit.data["results"][0]["rating"], 3)
        self.assertEqual(
            my_after_edit.data["results"][0]["body"],
            "The edited integration review.",
        )

        deleted = self.client.delete(self.review_detail_url(review_id))
        public_after_delete = self.assert_public_rating(
            average=None,
            count=0,
            distribution={"1": 0, "2": 0, "3": 0, "4": 0, "5": 0},
        )
        my_after_delete = self.client.get(self.my_reviews_url)

        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertIsNone(public_after_delete.data["viewer_review"])
        self.assertEqual(public_after_delete.data["reviews"], [])
        self.assertEqual(my_after_delete.data["count"], 0)
        self.assertEqual(my_after_delete.data["results"], [])
        self.assertFalse(GameReview.objects.filter(pk=review_id).exists())

    def test_one_review_per_user_and_game_is_shared_by_both_write_endpoints(self):
        created = self.create_review(self.first_user, rating=4, body="First write.")
        review_id = created.data["id"]
        duplicate = self.client.post(
            self.reviews_url,
            {"rating": 2, "body": "Duplicate public write."},
            format="json",
        )
        library_update = self.client.post(
            self.first_library_review_url,
            {"rating": 2, "body": "Updated through Library."},
            format="json",
        )
        my_reviews = self.client.get(self.my_reviews_url)

        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            duplicate.data["detail"],
            "You have already reviewed this game.",
        )
        self.assertEqual(library_update.status_code, status.HTTP_200_OK)
        self.assertEqual(library_update.data["id"], review_id)
        self.assertEqual(library_update.data["rating"], 2)
        self.assertEqual(
            GameReview.objects.filter(
                user=self.first_user,
                game=self.game,
            ).count(),
            1,
        )
        self.assertEqual(my_reviews.data["count"], 1)
        self.assertEqual(my_reviews.data["results"][0]["id"], review_id)
        self.assertEqual(my_reviews.data["results"][0]["rating"], 2)

    def test_average_rating_recalculates_after_multiple_users_edit_and_delete(self):
        first = self.create_review(self.first_user, rating=5, body="Five stars.")
        second = self.create_review(self.second_user, rating=1, body="One star.")

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assert_public_rating(
            average="3.00",
            count=2,
            distribution={"1": 1, "2": 0, "3": 0, "4": 0, "5": 1},
        )

        self.authenticate(self.first_user)
        updated = self.client.patch(
            self.review_detail_url(first.data["id"]),
            {"rating": 3},
            format="json",
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assert_public_rating(
            average="2.00",
            count=2,
            distribution={"1": 1, "2": 0, "3": 1, "4": 0, "5": 0},
        )

        self.authenticate(self.second_user)
        deleted = self.client.delete(self.review_detail_url(second.data["id"]))
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assert_public_rating(
            average="3.00",
            count=1,
            distribution={"1": 0, "2": 0, "3": 1, "4": 0, "5": 0},
        )

    def test_foreign_mutations_are_forbidden_and_my_reviews_remains_isolated(self):
        created = self.create_review(
            self.first_user,
            rating=4,
            body="Protected review.",
        )
        review_id = created.data["id"]

        self.authenticate(self.second_user)
        foreign_patch = self.client.patch(
            self.review_detail_url(review_id),
            {"rating": 1, "body": "Tampered."},
            format="json",
        )
        foreign_delete = self.client.delete(self.review_detail_url(review_id))
        second_users_reviews = self.client.get(self.my_reviews_url)
        public_for_second_user = self.client.get(self.reviews_url)

        self.assertEqual(foreign_patch.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(foreign_delete.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(second_users_reviews.data["count"], 0)
        self.assertEqual(second_users_reviews.data["results"], [])
        self.assertIsNone(public_for_second_user.data["viewer_review"])
        self.assertFalse(public_for_second_user.data["reviews"][0]["is_owner"])

        review = GameReview.objects.get(pk=review_id)
        self.assertEqual(review.rating, 4)
        self.assertEqual(review.body, "Protected review.")

        self.authenticate(self.first_user)
        first_users_reviews = self.client.get(self.my_reviews_url)
        self.assertEqual(first_users_reviews.data["count"], 1)
        self.assertEqual(first_users_reviews.data["results"][0]["id"], review_id)
