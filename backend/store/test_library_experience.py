from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from games.models import Game
from store.models import LibraryCollection, LibraryItem, Order, OrderItem


User = get_user_model()


class LibraryOrganizationAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="collection-owner",
            email="collection-owner@example.com",
            password="StrongPass123!",
        )
        self.other = User.objects.create_user(
            username="collection-other",
            email="collection-other@example.com",
            password="StrongPass123!",
        )
        self.owned_game = self.create_game("Owned Game", Decimal("15.00"))
        self.unowned_game = self.create_game("Unowned Game", Decimal("20.00"))
        self.item = self.grant_game(self.user, self.owned_game)
        self.client.force_authenticate(self.user)

    @staticmethod
    def create_game(title, price):
        return Game.objects.create(
            title=title,
            description=f"Description for {title}.",
            price=price,
            developer="Steamnt Studio",
            release_date=date(2026, 8, 1),
        )

    @staticmethod
    def grant_game(user, game):
        order = Order.objects.create(
            user=user,
            status=Order.Status.COMPLETED,
            total_price=game.price,
        )
        OrderItem.objects.create(
            order=order,
            game=game,
            price_at_purchase=game.price,
        )
        return LibraryItem.objects.create(user=user, game=game, order=order)

    def test_owner_can_toggle_favorite_state(self):
        response = self.client.patch(
            reverse("store:library-item-update", args=[self.item.pk]),
            {"is_favorite": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.item.refresh_from_db()
        self.assertTrue(self.item.is_favorite)

    def test_user_cannot_update_another_users_library_item(self):
        other_item = self.grant_game(self.other, self.unowned_game)
        response = self.client.patch(
            reverse("store:library-item-update", args=[other_item.pk]),
            {"is_favorite": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_collection_can_contain_owned_games(self):
        response = self.client.post(
            reverse("store:library-collections"),
            {"name": "Weekend", "game_ids": [self.owned_game.pk]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        collection = LibraryCollection.objects.get()
        self.assertEqual(collection.user, self.user)
        self.assertEqual(list(collection.games.all()), [self.owned_game])

    def test_collection_rejects_unowned_games(self):
        response = self.client.post(
            reverse("store:library-collections"),
            {"name": "Invalid", "game_ids": [self.unowned_game.pk]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(LibraryCollection.objects.exists())

    def test_collection_detail_is_owner_scoped(self):
        collection = LibraryCollection.objects.create(
            user=self.other,
            name="Private collection",
        )
        response = self.client.get(
            reverse("store:library-collection-detail", args=[collection.pk]),
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_collection_can_be_updated_and_deleted(self):
        collection = LibraryCollection.objects.create(user=self.user, name="Old name")
        url = reverse("store:library-collection-detail", args=[collection.pk])

        updated = self.client.patch(
            url,
            {"name": "New name", "game_ids": [self.owned_game.pk]},
            format="json",
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data["name"], "New name")
        self.assertEqual(updated.data["game_ids"], [self.owned_game.pk])

        deleted = self.client.delete(url)
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(LibraryCollection.objects.exists())
