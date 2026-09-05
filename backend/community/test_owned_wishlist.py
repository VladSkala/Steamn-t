from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from community.models import GameWishlist
from games.models import Game
from store.models import LibraryItem, Order


User = get_user_model()


class OwnedWishlistAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="owned-wishlist-user",
            email="owned-wishlist@example.com",
            password="safe-test-password",
        )
        self.game = Game.objects.create(
            title="Already Owned Wishlist Game",
            description="Owned wishlist guard.",
            price=Decimal("14.99"),
            developer="Integrity Studio",
            release_date=date(2026, 9, 3),
        )
        order = Order.objects.create(
            user=self.user,
            total_price=self.game.price,
            status=Order.Status.COMPLETED,
        )
        LibraryItem.objects.create(
            user=self.user,
            game=self.game,
            order=order,
        )
        self.client.force_authenticate(user=self.user)

    def test_owned_game_is_rejected_instead_of_becoming_wishlisted(self):
        response = self.client.post(
            reverse("community:wishlist-item-create"),
            {"game_id": self.game.pk},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("library", response.data["game_id"][0].lower())
        self.assertFalse(GameWishlist.objects.filter(user=self.user).exists())

    def test_stale_owned_row_still_returns_the_ownership_error(self):
        GameWishlist.objects.create(user=self.user, game=self.game)

        response = self.client.post(
            reverse("community:wishlist-item-create"),
            {"game_id": self.game.pk},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("library", response.data["game_id"][0].lower())
