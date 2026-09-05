from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from games.models import Game
from store.models import CartItem, LibraryItem, Order


User = get_user_model()


class CartOwnershipAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="owned-cart-user",
            email="owned-cart@example.com",
            password="safe-test-password",
        )
        self.game = Game.objects.create(
            title="Already Owned Game",
            description="Owned cart guard.",
            price=Decimal("29.99"),
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

    def test_owned_game_is_rejected_when_added_to_cart(self):
        response = self.client.post(
            reverse("store:cart-item-create"),
            {"game_id": self.game.pk},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "already_owned")
        self.assertEqual(response.data["game_ids"], [self.game.pk])
        self.assertIn("library", response.data["detail"].lower())
        self.assertFalse(
            CartItem.objects.filter(
                cart__user=self.user,
                game=self.game,
            ).exists(),
        )
