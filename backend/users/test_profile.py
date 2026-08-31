from datetime import date
from decimal import Decimal
from io import BytesIO
import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from community.models import CommunityPost, GameReview, GameWishlist, UserFollow
from games.models import Game
from store.models import LibraryItem, Order, OrderItem


User = get_user_model()


class CurrentUserProfileContractTests(APITestCase):
    profile_url = reverse("users:profile")

    def setUp(self):
        self.media_root = tempfile.mkdtemp(prefix="steamnt-profile-tests-")
        self.addCleanup(shutil.rmtree, self.media_root, ignore_errors=True)

        self.user = User.objects.create_user(
            username="profile-owner",
            email="owner@example.com",
            first_name="Profile",
            last_name="Owner",
            password="Strong-profile-password-2026!",
        )
        self.other_user = User.objects.create_user(
            username="other-player",
            email="other@example.com",
            password="Strong-other-password-2026!",
        )

    def authenticate(self, user=None):
        self.client.force_authenticate(user=user or self.user)

    def create_game(self, title, price="19.99"):
        return Game.objects.create(
            title=title,
            description=f"{title} description.",
            price=Decimal(price),
            developer="Profile Test Studio",
            release_date=date(2026, 8, 31),
            requirements="",
        )

    def grant_game(self, user, game, *, is_favorite=False):
        order = Order.objects.create(
            user=user,
            total_price=game.price,
            status=Order.Status.COMPLETED,
        )
        OrderItem.objects.create(
            order=order,
            game=game,
            price_at_purchase=game.price,
        )
        return LibraryItem.objects.create(
            user=user,
            game=game,
            order=order,
            is_favorite=is_favorite,
        )

    def test_profile_returns_figma_summary_for_current_user_only(self):
        first_game = self.create_game("Profile Game One")
        second_game = self.create_game("Profile Game Two", "5.01")
        other_game = self.create_game("Other Player Game", "7.50")
        friend = User.objects.create_user(
            username="profile-friend",
            email="friend@example.com",
            password="Strong-friend-password-2026!",
        )

        self.grant_game(self.user, first_game, is_favorite=True)
        self.grant_game(self.user, second_game)
        self.grant_game(self.other_user, other_game, is_favorite=True)

        GameWishlist.objects.create(user=self.user, game=other_game)
        GameWishlist.objects.create(user=self.other_user, game=first_game)
        GameReview.objects.create(
            user=self.user,
            game=first_game,
            rating=5,
            body="Excellent profile test game.",
        )
        GameReview.objects.create(
            user=self.other_user,
            game=other_game,
            rating=3,
            body="Other user's review.",
        )
        CommunityPost.objects.create(
            author=self.user,
            game=first_game,
            title="Published profile post",
            body="Visible in profile statistics.",
            is_published=True,
        )
        CommunityPost.objects.create(
            author=self.user,
            title="Draft profile post",
            body="Not counted in public profile statistics.",
            is_published=False,
        )
        CommunityPost.objects.create(
            author=self.other_user,
            title="Other user's post",
            body="Must never affect the current user's statistics.",
            is_published=True,
        )
        UserFollow.objects.create(follower=self.user, following=friend)
        UserFollow.objects.create(follower=self.other_user, following=self.user)
        UserFollow.objects.create(follower=friend, following=self.user)

        self.authenticate()
        response = self.client.get(self.profile_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.user.pk)
        self.assertEqual(response.data["display_name"], "Profile Owner")
        self.assertEqual(
            response.data["stats"],
            {
                "library_games": 2,
                "favorite_games": 1,
                "wishlist_games": 1,
                "reviews": 1,
                "posts": 1,
                "followers": 2,
                "following": 1,
            },
        )
        self.assertNotIn("orders", response.data)

    def test_profile_never_leaks_another_users_identity_or_stats(self):
        own_game = self.create_game("Owner Game")
        other_game = self.create_game("Other Game")
        self.grant_game(self.user, own_game)
        self.grant_game(self.other_user, other_game, is_favorite=True)
        GameWishlist.objects.create(user=self.other_user, game=own_game)

        self.authenticate(self.other_user)
        response = self.client.get(self.profile_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.other_user.pk)
        self.assertEqual(response.data["email"], self.other_user.email)
        self.assertEqual(response.data["stats"]["library_games"], 1)
        self.assertEqual(response.data["stats"]["favorite_games"], 1)
        self.assertEqual(response.data["stats"]["wishlist_games"], 1)

    def test_profile_patch_updates_editable_fields_but_not_summary(self):
        game = self.create_game("Read-only Summary Game")
        self.grant_game(self.user, game)
        self.authenticate()

        response = self.client.patch(
            self.profile_url,
            {
                "id": 99999,
                "username": "updated-profile-owner",
                "email": "UPDATED.OWNER@EXAMPLE.COM",
                "first_name": "Updated",
                "last_name": "Player",
                "display_name": "Forged Name",
                "stats": {"library_games": 999},
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertNotEqual(self.user.pk, 99999)
        self.assertEqual(self.user.username, "updated-profile-owner")
        self.assertEqual(self.user.email, "updated.owner@example.com")
        self.assertEqual(response.data["display_name"], "Updated Player")
        self.assertEqual(response.data["stats"]["library_games"], 1)

    def test_profile_accepts_and_clears_a_valid_avatar(self):
        image_bytes = BytesIO()
        Image.new("RGB", (8, 8), color=(52, 211, 153)).save(
            image_bytes,
            format="PNG",
        )
        image_bytes.seek(0)
        avatar = SimpleUploadedFile(
            "profile-avatar.png",
            image_bytes.read(),
            content_type="image/png",
        )
        self.authenticate()

        with override_settings(MEDIA_ROOT=self.media_root):
            upload_response = self.client.patch(
                self.profile_url,
                {"avatar": avatar},
                format="multipart",
            )
            clear_response = self.client.patch(
                self.profile_url,
                {"avatar": None},
                format="json",
            )

        self.assertEqual(upload_response.status_code, status.HTTP_200_OK)
        self.assertIn("/media/avatars/", upload_response.data["avatar"])
        self.assertEqual(clear_response.status_code, status.HTTP_200_OK)
        self.assertIsNone(clear_response.data["avatar"])

    def test_profile_supports_only_get_and_patch(self):
        self.authenticate()

        self.assertEqual(
            self.client.put(self.profile_url, {}, format="json").status_code,
            status.HTTP_405_METHOD_NOT_ALLOWED,
        )
        self.assertEqual(
            self.client.delete(self.profile_url).status_code,
            status.HTTP_405_METHOD_NOT_ALLOWED,
        )
