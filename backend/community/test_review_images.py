import shutil
import tempfile
from io import BytesIO
from pathlib import Path

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from community.models import GameReview, GameReviewImage
from games.models import Game
from store.models import LibraryItem, Order
from users.models import User


def image_upload(name="review.png", image_format="PNG"):
    output = BytesIO()
    Image.new("RGB", (24, 24), color=(105, 79, 220)).save(output, format=image_format)
    content_type = "image/jpeg" if image_format == "JPEG" else "image/png"
    return SimpleUploadedFile(name, output.getvalue(), content_type=content_type)


class ReviewImageAPITests(APITestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp(prefix="steamnt-review-tests-")
        self.override = override_settings(MEDIA_ROOT=self.media_root)
        self.override.enable()
        self.addCleanup(self.override.disable)
        self.addCleanup(shutil.rmtree, self.media_root, True)
        self.user = User.objects.create_user(username="review-images-user", email="review-images@example.com", password="StrongPass123!")
        self.game = Game.objects.create(title="Review Image Game", description="Owned game used for review image tests.", price="19.99", developer="Review Studio", release_date="2026-09-04")
        order = Order.objects.create(user=self.user, total_price=self.game.price, status=Order.Status.COMPLETED)
        LibraryItem.objects.create(user=self.user, game=self.game, order=order)
        self.url = reverse("community:game-review", kwargs={"game_id": self.game.pk})
        self.client.force_authenticate(user=self.user)

    def test_multipart_review_creates_and_returns_ordered_images(self):
        response = self.client.put(self.url, {"rating": 5, "body": "A review with two useful screenshots.", "replace_images": "1", "images": [image_upload("first.png"), image_upload("second.jpg", "JPEG")]}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data["images"]), 2)
        self.assertEqual([image["position"] for image in response.data["images"]], [0, 1])

    def test_update_replaces_unkept_image(self):
        review = GameReview.objects.create(user=self.user, game=self.game, rating=4, body="Original review body.")
        kept = GameReviewImage.objects.create(review=review, image=image_upload("keep.png"), position=0)
        removed = GameReviewImage.objects.create(review=review, image=image_upload("remove.png"), position=1)
        removed_path = Path(settings.MEDIA_ROOT) / removed.image.name
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.put(self.url, {"rating": 5, "body": "Updated review with a new screenshot.", "replace_images": "1", "keep_image_ids": [str(kept.pk)], "images": [image_upload("new.png")]}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["images"]), 2)
        self.assertFalse(GameReviewImage.objects.filter(pk=removed.pk).exists())
        self.assertFalse(removed_path.exists())

    def test_rejects_too_many_invalid_and_oversized_images(self):
        too_many = self.client.put(self.url, {"rating": 4, "body": "Too many screenshots.", "replace_images": "1", "images": [image_upload(f"image-{index}.png") for index in range(5)]}, format="multipart")
        self.assertEqual(too_many.status_code, status.HTTP_400_BAD_REQUEST)
        invalid = self.client.put(self.url, {"rating": 4, "body": "Invalid file.", "replace_images": "1", "images": [SimpleUploadedFile("notes.txt", b"no", content_type="text/plain")]}, format="multipart")
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        oversized = image_upload("source.png").read() + b"0" * (5 * 1024 * 1024)
        too_large = self.client.put(self.url, {"rating": 4, "body": "Oversized image.", "replace_images": "1", "images": [SimpleUploadedFile("oversized.png", oversized, content_type="image/png")]}, format="multipart")
        self.assertEqual(too_large.status_code, status.HTTP_400_BAD_REQUEST)

    def test_json_update_preserves_images_and_delete_removes_file(self):
        review = GameReview.objects.create(user=self.user, game=self.game, rating=3, body="Existing review body.")
        image = GameReviewImage.objects.create(review=review, image=image_upload("preserved.png"), position=0)
        image_path = Path(settings.MEDIA_ROOT) / image.image.name
        response = self.client.patch(self.url, {"rating": 4, "body": "Updated through JSON."}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["images"]), 1)
        self.assertTrue(image_path.exists())
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(image_path.exists())
