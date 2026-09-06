import shutil
import tempfile
from datetime import date
from decimal import Decimal
from io import BytesIO
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from community.models import GameReview, GameReviewImage
from games.models import Game
from store.models import LibraryItem, Order, OrderItem


User = get_user_model()


def image_upload(name="review.png"):
    output = BytesIO()
    Image.new("RGB", (24, 24), color=(105, 79, 220)).save(output, format="PNG")
    return SimpleUploadedFile(name, output.getvalue(), content_type="image/png")


class PublicReviewsAPITests(APITestCase):
    def setUp(self):
        self.owner = self.create_user("review-owner")
        self.other_user = self.create_user("other-reviewer")
        self.non_owner = self.create_user("non-owner")
        self.game = self.create_game("Public Review Game")
        self.other_game = self.create_game("Other Review Game")
        self.grant_game(self.owner, self.game)
        self.grant_game(self.other_user, self.game)
        self.list_url = reverse("community:game-review-list", kwargs={"game_id": self.game.pk})

    @staticmethod
    def create_user(username):
        return User.objects.create_user(username=username, email=f"{username}@example.com")

    @staticmethod
    def create_game(title):
        return Game.objects.create(
            title=title,
            description=f"Description for {title}.",
            price=Decimal("19.99"),
            developer="Reviews Studio",
            release_date=date(2026, 9, 6),
            requirements="8 GB RAM",
        )

    @staticmethod
    def grant_game(user, game):
        order = Order.objects.create(
            user=user,
            total_price=game.price,
            status=Order.Status.COMPLETED,
        )
        OrderItem.objects.create(order=order, game=game, price_at_purchase=game.price)
        return LibraryItem.objects.create(user=user, game=game, order=order)

    def detail_url(self, review):
        return reverse(
            "community:game-review-detail",
            kwargs={"game_id": self.game.pk, "review_id": review.pk},
        )

    def create_review(self, user=None, rating=5, body="A useful review."):
        self.client.force_authenticate(user=user or self.owner)
        return self.client.post(
            self.list_url,
            {"rating": rating, "body": body},
            format="json",
        )

    def test_public_empty_list_has_stable_frontend_contract(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["game_id"], self.game.pk)
        self.assertIsNone(response.data["average_rating"])
        self.assertEqual(response.data["review_count"], 0)
        self.assertEqual(
            response.data["rating_distribution"],
            {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0},
        )
        self.assertIsNone(response.data["viewer_review"])
        self.assertEqual(response.data["reviews"], [])

    def test_create_requires_authentication_and_purchase(self):
        anonymous = self.client.post(
            self.list_url,
            {"rating": 5, "body": "Anonymous."},
            format="json",
        )
        self.client.force_authenticate(user=self.non_owner)
        unowned = self.client.post(
            self.list_url,
            {"rating": 5, "body": "Unowned."},
            format="json",
        )
        self.assertEqual(anonymous.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(unowned.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(GameReview.objects.exists())

    def test_owner_can_create_and_list_identifies_viewer_review(self):
        created = self.create_review(rating=4, body="  Strong release.  ")
        listed = self.client.get(self.list_url)
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data["game_id"], self.game.pk)
        self.assertEqual(created.data["author"]["id"], self.owner.pk)
        self.assertEqual(created.data["body"], "Strong release.")
        self.assertTrue(created.data["is_owner"])
        self.assertEqual(listed.data["average_rating"], "4.00")
        self.assertEqual(listed.data["review_count"], 1)
        self.assertEqual(listed.data["rating_distribution"]["4"], 1)
        self.assertEqual(listed.data["viewer_review"]["id"], created.data["id"])

    def test_duplicate_review_is_rejected_without_another_row(self):
        self.assertEqual(self.create_review().status_code, status.HTTP_201_CREATED)
        duplicate = self.create_review(body="Duplicate.")
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(duplicate.data["detail"], "You have already reviewed this game.")
        self.assertEqual(GameReview.objects.filter(game=self.game).count(), 1)

    def test_aggregates_distribution_and_game_detail_are_correct(self):
        ratings = [5, 5, 4, 2]
        users = [self.owner, self.other_user, self.non_owner, self.create_user("fourth")]
        for user, rating in zip(users, ratings, strict=True):
            GameReview.objects.create(
                user=user,
                game=self.game,
                rating=rating,
                body=f"Rating {rating}.",
            )
        reviews = self.client.get(self.list_url)
        detail = self.client.get(reverse("games:game-detail", kwargs={"pk": self.game.pk}))
        self.assertEqual(reviews.data["average_rating"], "4.00")
        self.assertEqual(reviews.data["review_count"], 4)
        self.assertEqual(
            reviews.data["rating_distribution"],
            {"1": 0, "2": 1, "3": 0, "4": 1, "5": 2},
        )
        self.assertEqual(detail.data["average_rating"], "4.00")
        self.assertEqual(detail.data["review_count"], 4)

    def test_list_is_paginated_newest_first_and_capped(self):
        ids = []
        for index in range(12):
            review = GameReview.objects.create(
                user=self.create_user(f"page-{index}"),
                game=self.game,
                rating=(index % 5) + 1,
                body=f"Review {index}.",
            )
            ids.append(review.pk)
        first = self.client.get(self.list_url, {"page_size": 5})
        second = self.client.get(self.list_url, {"page": 2, "page_size": 5})
        capped = self.client.get(self.list_url, {"page_size": 500})
        self.assertEqual(first.data["pagination"]["total_pages"], 3)
        self.assertEqual(
            [item["id"] for item in first.data["reviews"]],
            list(reversed(ids))[:5],
        )
        self.assertEqual(
            [item["id"] for item in second.data["reviews"]],
            list(reversed(ids))[5:10],
        )
        self.assertEqual(capped.data["pagination"]["page_size"], 50)

    def test_detail_is_public_but_only_author_can_mutate(self):
        review = GameReview.objects.create(
            user=self.owner,
            game=self.game,
            rating=4,
            body="Original.",
        )
        url = self.detail_url(review)
        public = self.client.get(url)
        self.client.force_authenticate(user=self.other_user)
        forbidden_patch = self.client.patch(url, {"rating": 1}, format="json")
        forbidden_delete = self.client.delete(url)
        self.client.force_authenticate(user=self.owner)
        patched = self.client.patch(url, {"rating": 5}, format="json")
        incomplete_put = self.client.put(url, {"rating": 3}, format="json")
        replaced = self.client.put(
            url,
            {"rating": 3, "body": "Replaced."},
            format="json",
        )
        deleted = self.client.delete(url)
        self.assertFalse(public.data["is_owner"])
        self.assertEqual(forbidden_patch.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(forbidden_delete.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(patched.data["rating"], 5)
        self.assertEqual(incomplete_put.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(replaced.data["body"], "Replaced.")
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)

    def test_invalid_reviews_fail_serializer_and_database_constraints(self):
        self.client.force_authenticate(user=self.owner)
        for payload in (
            {"rating": 0, "body": "Low."},
            {"rating": 6, "body": "High."},
            {"rating": 5, "body": "   "},
            {"body": "Missing rating."},
            {"rating": 5},
        ):
            self.assertEqual(
                self.client.post(self.list_url, payload, format="json").status_code,
                status.HTTP_400_BAD_REQUEST,
            )
        for rating in (0, 6):
            with self.assertRaises(IntegrityError):
                with transaction.atomic():
                    GameReview.objects.create(
                        user=self.owner,
                        game=self.game,
                        rating=rating,
                        body="Bypass serializer.",
                    )

    def test_public_crud_reuses_review_image_lifecycle(self):
        media_root = tempfile.mkdtemp(prefix="kan30-review-api-")
        self.addCleanup(shutil.rmtree, media_root, True)
        self.client.force_authenticate(user=self.owner)
        with override_settings(MEDIA_ROOT=media_root):
            created = self.client.post(
                self.list_url,
                {"rating": 5, "body": "Evidence.", "images": [image_upload()]},
                format="multipart",
            )
            review = GameReview.objects.get(pk=created.data["id"])
            image = GameReviewImage.objects.get(review=review)
            image_path = Path(media_root) / image.image.name
            with self.captureOnCommitCallbacks(execute=True):
                deleted = self.client.delete(self.detail_url(review))
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(created.data["images"]), 1)
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(image_path.exists())

    def test_unsupported_methods_and_mismatched_game_are_rejected(self):
        review = GameReview.objects.create(
            user=self.owner,
            game=self.game,
            rating=5,
            body="Route contract.",
        )
        self.client.force_authenticate(user=self.owner)
        self.assertEqual(
            self.client.put(self.list_url, {}, format="json").status_code,
            status.HTTP_405_METHOD_NOT_ALLOWED,
        )
        self.assertEqual(
            self.client.post(self.detail_url(review), {}, format="json").status_code,
            status.HTTP_405_METHOD_NOT_ALLOWED,
        )
        mismatched = reverse(
            "community:game-review-detail",
            kwargs={"game_id": self.other_game.pk, "review_id": review.pk},
        )
        self.assertEqual(self.client.get(mismatched).status_code, status.HTTP_404_NOT_FOUND)
