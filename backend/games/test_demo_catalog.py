import io
import tempfile
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APITestCase

from community.models import GameReview, GameWishlist
from games.management.commands.seed_store_demo import (
    DEMO_FEATURED_GAME_COUNT,
    DEMO_SCREENSHOT_COUNT,
)
from games.models import Game, GameScreenshot, Genre
from store.models import CartItem, LibraryItem, Order


class DemoCatalogTests(TestCase):
    def setUp(self):
        self.media = tempfile.TemporaryDirectory()
        self.addCleanup(self.media.cleanup)
        setting = override_settings(MEDIA_ROOT=self.media.name)
        setting.enable()
        self.addCleanup(setting.disable)

    def seed(self, **kwargs):
        output = io.StringIO()
        call_command("seed_store_demo", stdout=output, **kwargs)
        return output.getvalue()

    def test_offline_catalog_has_all_artwork_and_no_social_or_account_side_effects(self):
        self.seed()
        self.assertEqual(Game.objects.count(), 12)
        self.assertGreaterEqual(Game.objects.count(), 10)
        self.assertEqual(Genre.objects.count(), 8)
        self.assertGreaterEqual(Genre.objects.count(), 5)
        self.assertEqual(GameScreenshot.objects.count(), 36)
        self.assertEqual(
            Game.objects.filter(is_featured=True).count(),
            DEMO_FEATURED_GAME_COUNT,
        )
        self.assertEqual(get_user_model().objects.count(), 0)
        self.assertEqual(Order.objects.count(), 0)
        self.assertEqual(GameReview.objects.count(), 0)
        for game in Game.objects.all():
            self.assertTrue(Path(game.cover.path).is_file())
            self.assertGreater(game.genres.count(), 0)
            self.assertIn("fictional", game.description)
            self.assertIn("Minimum", game.requirements)
            self.assertIn("Recommended", game.requirements)
            self.assertEqual(game.download_url, "")
            self.assertEqual(
                list(game.screenshots.values_list("position", flat=True)),
                list(range(DEMO_SCREENSHOT_COUNT)),
            )
        for image in GameScreenshot.objects.all():
            self.assertTrue(Path(image.image.path).is_file())

    def test_seed_is_idempotent_in_rows_and_files(self):
        self.seed()
        files = sorted(
            str(path.relative_to(self.media.name))
            for path in Path(self.media.name).rglob("*.webp")
        )
        self.seed()
        self.assertEqual(Game.objects.count(), 12)
        self.assertEqual(GameScreenshot.objects.count(), 36)
        self.assertEqual(
            Game.objects.filter(is_featured=True).count(),
            DEMO_FEATURED_GAME_COUNT,
        )
        self.assertEqual(
            files,
            sorted(
                str(path.relative_to(self.media.name))
                for path in Path(self.media.name).rglob("*.webp")
            ),
        )

    def test_seed_does_not_overwrite_existing_game_with_same_title(self):
        game = Game.objects.create(
            title="Aether Drift",
            developer="My real studio",
            price="2.34",
            description="Keep this text",
            release_date="2024-01-01",
        )
        self.seed()
        game.refresh_from_db()
        self.assertEqual(game.description, "Keep this text")
        self.assertEqual(str(game.price), "2.34")
        self.assertEqual(Game.objects.count(), 13)

    def test_existing_demo_entry_is_not_reset(self):
        self.seed()
        game = Game.objects.get(title="Aether Drift")
        non_featured = Game.objects.get(title="Wildwood")
        game.description = "Edited by project owner"
        game.is_featured = False
        game.save()
        non_featured.is_featured = True
        non_featured.save()
        self.seed()
        game.refresh_from_db()
        non_featured.refresh_from_db()
        self.assertEqual(game.description, "Edited by project owner")
        self.assertTrue(game.is_featured)
        self.assertFalse(non_featured.is_featured)

    def test_seeded_featured_endpoint_returns_complete_selection(self):
        self.seed()

        response = self.client.get("/api/games/featured/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), DEMO_FEATURED_GAME_COUNT)
        self.assertEqual(
            [game["id"] for game in payload],
            list(
                Game.objects.filter(is_featured=True)
                .order_by("title", "pk")
                .values_list("pk", flat=True)
            ),
        )

    def test_optional_demo_user_has_disjoint_collections_and_repeat_does_not_reset_password(self):
        self.seed(with_demo_user=True)
        user = get_user_model().objects.get(username="steamnt_demo")
        original_password = user.password
        self.assertEqual(LibraryItem.objects.filter(user=user).count(), 5)
        self.assertEqual(GameWishlist.objects.filter(user=user).count(), 4)
        self.assertEqual(CartItem.objects.filter(cart__user=user).count(), 2)
        owned = set(LibraryItem.objects.filter(user=user).values_list("game_id", flat=True))
        wishlist = set(
            GameWishlist.objects.filter(user=user).values_list("game_id", flat=True)
        )
        cart = set(
            CartItem.objects.filter(cart__user=user).values_list("game_id", flat=True)
        )
        self.assertFalse(owned & wishlist)
        self.assertFalse(owned & cart)
        self.assertEqual(Order.objects.filter(user=user, status=Order.Status.COMPLETED).count(), 1)
        output = self.seed(with_demo_user=True)
        user.refresh_from_db()
        self.assertEqual(user.password, original_password)
        self.assertEqual(Order.objects.count(), 1)
        self.assertNotIn("One-time generated password", output)

    def test_existing_username_and_other_users_are_never_populated(self):
        User = get_user_model()
        existing = User.objects.create_user(
            username="steamnt_demo",
            email="existing@example.invalid",
            password="existing-only",
        )
        other = User.objects.create_user(
            username="untouched",
            email="untouched@example.invalid",
            password="existing-only",
        )
        self.seed(with_demo_user=True)
        existing.refresh_from_db()
        self.assertTrue(existing.check_password("existing-only"))
        self.assertEqual(Order.objects.count(), 0)
        self.assertEqual(GameWishlist.objects.count(), 0)
        self.assertEqual(LibraryItem.objects.count(), 0)
        self.assertEqual(User.objects.count(), 2)
        self.assertTrue(User.objects.filter(pk=other.pk).exists())


class GameGalleryTests(APITestCase):
    def setUp(self):
        self.game = Game.objects.create(
            title="Gallery test",
            developer="Demo",
            description="Example",
            price="1.00",
            release_date="2026-01-01",
        )
        self.url = f"/api/games/{self.game.pk}/"

    def test_empty_gallery_is_an_array(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["screenshots"], [])

    def test_gallery_is_ordered_and_urls_are_absolute(self):
        GameScreenshot.objects.create(
            game=self.game,
            position=2,
            image="games/b.webp",
            caption="Second",
        )
        GameScreenshot.objects.create(
            game=self.game,
            position=0,
            image="games/a.webp",
            caption="First",
        )
        response = self.client.get(self.url)
        self.assertEqual(
            [image["caption"] for image in response.data["screenshots"]],
            ["First", "Second"],
        )
        self.assertEqual(
            response.data["screenshots"][0]["image"],
            "http://testserver/media/games/a.webp",
        )

    def test_gallery_does_not_leak_other_game_art(self):
        other = Game.objects.create(
            title="Other",
            developer="Demo",
            description="Other",
            price="1.00",
            release_date="2026-01-01",
        )
        GameScreenshot.objects.create(game=other, image="games/other.webp")
        self.assertEqual(self.client.get(self.url).data["screenshots"], [])

    def test_detail_stays_read_only(self):
        user = get_user_model().objects.create_user(
            username="reader",
            email="reader@example.invalid",
            password="unused",
        )
        self.client.force_authenticate(user=user)
        self.assertEqual(
            self.client.post(
                self.url,
                {"screenshots": []},
                format="json",
            ).status_code,
            405,
        )
        self.assertEqual(
            self.client.patch(
                self.url,
                {"title": "Changed"},
                format="json",
            ).status_code,
            405,
        )
        self.game.refresh_from_db()
        self.assertEqual(self.game.title, "Gallery test")
