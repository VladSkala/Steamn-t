"""Focused Django Admin coverage for KAN-41."""

from django.contrib import admin
from django.test import SimpleTestCase

from community.admin import GameReviewAdmin, GameReviewImageInline
from community.models import GameReview, GameReviewImage
from games.admin import GameAdmin, GameScreenshotInline, GenreAdmin
from games.models import Game, Genre


class CatalogAdminConfigurationTests(SimpleTestCase):
    def test_game_admin_manages_featured_games_and_screenshots(self):
        game_admin = admin.site._registry[Game]

        self.assertIsInstance(game_admin, GameAdmin)
        self.assertIn("is_featured", game_admin.list_display)
        self.assertIn("is_featured", game_admin.list_filter)
        self.assertIn("is_featured", game_admin.list_editable)
        self.assertEqual(game_admin.inlines, (GameScreenshotInline,))
        self.assertEqual(GameScreenshotInline.ordering, ("position", "pk"))

    def test_genre_admin_is_searchable_and_shows_usage(self):
        genre_admin = admin.site._registry[Genre]

        self.assertIsInstance(genre_admin, GenreAdmin)
        self.assertEqual(genre_admin.list_display, ("name", "game_count"))
        self.assertEqual(genre_admin.search_fields, ("name",))
        self.assertEqual(genre_admin.ordering, ("name",))

    def test_review_admin_is_searchable_filterable_and_manages_images(self):
        review_admin = admin.site._registry[GameReview]

        self.assertIsInstance(review_admin, GameReviewAdmin)
        self.assertEqual(review_admin.list_select_related, ("game", "user"))
        self.assertIn("rating", review_admin.list_filter)
        self.assertIn("game__title", review_admin.search_fields)
        self.assertIn("user__username", review_admin.search_fields)
        self.assertEqual(review_admin.inlines, (GameReviewImageInline,))
        self.assertEqual(GameReviewImageInline.model, GameReviewImage)
        self.assertEqual(GameReviewImageInline.ordering, ("position", "pk"))
