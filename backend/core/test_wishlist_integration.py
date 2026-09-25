"""End-to-end API coverage for the KAN-29 Wishlist integration flow."""

from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from community.models import GameWishlist
from games.models import Game
from store.models import CartItem, LibraryItem, Order


User = get_user_model()


class WishlistIntegrationAPITests(APITestCase):
    """Verify Wishlist, Cart, checkout and account isolation as one workflow."""

    def setUp(self):
        self.first_user = User.objects.create_user(
            username="wishlist-integration-one",
            email="wishlist-integration-one@example.com",
            password="safe-test-password",
        )
        self.second_user = User.objects.create_user(
            username="wishlist-integration-two",
            email="wishlist-integration-two@example.com",
            password="safe-test-password",
        )
        self.game = self.create_game("Wishlist Integration Game", "24.99")
        self.other_game = self.create_game("Wishlist Integration Extra", "7.50")
        self.wishlist_url = reverse("community:wishlist")
        self.wishlist_items_url = reverse("community:wishlist-item-create")
        self.cart_url = reverse("store:cart")
        self.cart_items_url = reverse("store:cart-item-create")
        self.checkout_url = reverse("store:order-checkout")

    @staticmethod
    def create_game(title, price):
        return Game.objects.create(
            title=title,
            description="A game used to verify the complete Wishlist flow.",
            price=Decimal(price),
            developer="Integration Studio",
            release_date=date(2026, 9, 6),
            requirements="8 GB RAM",
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def add_to_wishlist(self, game):
        return self.client.post(
            self.wishlist_items_url,
            {"game_id": game.pk},
            format="json",
        )

    def remove_from_wishlist(self, game):
        return self.client.delete(
            reverse("community:wishlist-item-delete", args=[game.pk]),
        )

    def add_to_cart(self, game):
        return self.client.post(
            self.cart_items_url,
            {"game_id": game.pk},
            format="json",
        )

    def test_add_list_and_remove_round_trip_through_public_api(self):
        self.authenticate(self.first_user)

        created = self.add_to_wishlist(self.game)
        listed = self.client.get(self.wishlist_url)
        removed = self.remove_from_wishlist(self.game)
        listed_after_delete = self.client.get(self.wishlist_url)

        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data["game"]["id"], self.game.pk)
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["game"]["id"] for item in listed.data["items"]],
            [self.game.pk],
        )
        self.assertEqual(removed.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(listed_after_delete.data, {"items": []})
        self.assertFalse(
            GameWishlist.objects.filter(
                user=self.first_user,
                game=self.game,
            ).exists(),
        )

    def test_duplicate_then_cart_checkout_keeps_every_resource_consistent(self):
        self.authenticate(self.first_user)

        created = self.add_to_wishlist(self.game)
        duplicate = self.add_to_wishlist(self.game)
        wishlist_count_after_duplicate = GameWishlist.objects.filter(
            user=self.first_user,
            game=self.game,
        ).count()
        cart = self.add_to_cart(self.game)
        wishlist_while_in_cart = self.client.get(self.wishlist_url)
        checkout = self.client.post(self.checkout_url, {}, format="json")
        wishlist_after_checkout = self.client.get(self.wishlist_url)
        cart_after_checkout = self.client.get(self.cart_url)
        readd_owned_game = self.add_to_wishlist(self.game)

        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            str(duplicate.data["game_id"][0]),
            "This game is already in your wishlist.",
        )
        self.assertEqual(wishlist_count_after_duplicate, 1)
        self.assertEqual(cart.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            [item["game"]["id"] for item in cart.data["items"]],
            [self.game.pk],
        )
        self.assertEqual(
            [item["game"]["id"] for item in wishlist_while_in_cart.data["items"]],
            [self.game.pk],
            "Cart is not ownership; Wishlist cleanup must wait for checkout.",
        )
        self.assertEqual(checkout.status_code, status.HTTP_201_CREATED)
        self.assertEqual(checkout.data["status"], Order.Status.COMPLETED)
        self.assertEqual(wishlist_after_checkout.data, {"items": []})
        self.assertEqual(cart_after_checkout.data["items"], [])
        self.assertEqual(cart_after_checkout.data["total"], "0.00")
        self.assertEqual(
            GameWishlist.objects.filter(
                user=self.first_user,
                game=self.game,
            ).count(),
            0,
        )
        self.assertTrue(
            LibraryItem.objects.filter(
                user=self.first_user,
                game=self.game,
                order__status=Order.Status.COMPLETED,
            ).exists(),
        )
        self.assertFalse(
            CartItem.objects.filter(
                cart__user=self.first_user,
                game=self.game,
            ).exists(),
        )
        self.assertEqual(readd_owned_game.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("library", str(readd_owned_game.data["game_id"][0]).lower())

    def test_accounts_remain_isolated_across_delete_cart_and_checkout(self):
        self.authenticate(self.first_user)
        self.assertEqual(self.add_to_wishlist(self.game).status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.add_to_wishlist(self.other_game).status_code, status.HTTP_201_CREATED)

        self.authenticate(self.second_user)
        self.assertEqual(self.add_to_wishlist(self.game).status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            [
                item["game"]["id"]
                for item in self.client.get(self.wishlist_url).data["items"]
            ],
            [self.game.pk],
        )

        self.authenticate(self.first_user)
        self.assertEqual(self.remove_from_wishlist(self.other_game).status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(self.add_to_cart(self.game).status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            self.client.post(self.checkout_url, {}, format="json").status_code,
            status.HTTP_201_CREATED,
        )

        self.authenticate(self.second_user)
        second_users_list = self.client.get(self.wishlist_url)
        second_users_cart = self.client.get(self.cart_url)

        self.assertEqual(
            [item["game"]["id"] for item in second_users_list.data["items"]],
            [self.game.pk],
        )
        self.assertEqual(second_users_cart.data["items"], [])
        self.assertFalse(LibraryItem.objects.filter(user=self.second_user).exists())
        self.assertTrue(
            GameWishlist.objects.filter(
                user=self.second_user,
                game=self.game,
            ).exists(),
        )
        self.assertFalse(
            GameWishlist.objects.filter(
                user=self.first_user,
                game=self.other_game,
            ).exists(),
        )
