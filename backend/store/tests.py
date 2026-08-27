from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from games.models import Game
from store.models import Cart, CartItem, LibraryItem, Order, OrderItem


User = get_user_model()


class StoreModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="buyer",
            email="buyer@example.com",
            password="safe-test-password",
        )
        self.game = Game.objects.create(
            title="Store Test Game",
            description="A game used to verify store relationships.",
            price=Decimal("29.99"),
            developer="Steamn't Team",
            release_date=date(2026, 8, 24),
            requirements="Test requirements",
        )

    def test_user_has_only_one_cart(self):
        Cart.objects.create(user=self.user)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Cart.objects.create(user=self.user)

    def test_cart_rejects_duplicate_game(self):
        cart = Cart.objects.create(user=self.user)
        CartItem.objects.create(cart=cart, game=self.game)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                CartItem.objects.create(cart=cart, game=self.game)

    def test_order_item_keeps_purchase_price(self):
        order = Order.objects.create(
            user=self.user,
            total_price=Decimal("19.99"),
            status=Order.Status.COMPLETED,
        )
        item = OrderItem.objects.create(
            order=order,
            game=self.game,
            price_at_purchase=Decimal("19.99"),
        )

        self.game.price = Decimal("39.99")
        self.game.save(update_fields=["price", "updated_at"])
        item.refresh_from_db()

        self.assertEqual(item.price_at_purchase, Decimal("19.99"))

    def test_library_rejects_duplicate_game_for_user(self):
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

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                LibraryItem.objects.create(
                    user=self.user,
                    game=self.game,
                    order=order,
                )

    def test_library_purchased_at_uses_creation_time(self):
        order = Order.objects.create(
            user=self.user,
            total_price=self.game.price,
            status=Order.Status.COMPLETED,
        )
        library_item = LibraryItem.objects.create(
            user=self.user,
            game=self.game,
            order=order,
        )

        self.assertEqual(library_item.purchased_at, library_item.created_at)


class CartAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="cart-owner",
            email="cart-owner@example.com",
            password="safe-test-password",
        )
        self.other_user = User.objects.create_user(
            username="other-cart-owner",
            email="other-cart-owner@example.com",
            password="safe-test-password",
        )
        self.game = Game.objects.create(
            title="Cart Game",
            description="A game used to verify the cart API.",
            price=Decimal("19.99"),
            cover="games/covers/2026/08/cart-game.webp",
            developer="Cart Studio",
            release_date=date(2026, 8, 28),
            requirements="8 GB RAM",
        )
        self.second_game = Game.objects.create(
            title="Second Cart Game",
            description="A second game used to calculate the total.",
            price=Decimal("5.01"),
            developer="Second Studio",
            release_date=date(2026, 8, 27),
            requirements="4 GB RAM",
        )
        self.cart_url = reverse("store:cart")
        self.items_url = reverse("store:cart-item-create")

    @staticmethod
    def delete_url(game):
        return reverse(
            "store:cart-item-delete",
            kwargs={"game_id": game.pk},
        )

    def authenticate(self, user=None):
        self.client.force_authenticate(user=user or self.user)

    def test_cart_endpoints_require_authentication(self):
        responses = [
            self.client.get(self.cart_url),
            self.client.post(
                self.items_url,
                {"game_id": self.game.pk},
                format="json",
            ),
            self.client.delete(self.delete_url(self.game)),
        ]

        for response in responses:
            with self.subTest(path=response.request["PATH_INFO"]):
                self.assertEqual(
                    response.status_code,
                    status.HTTP_401_UNAUTHORIZED,
                )

        self.assertFalse(Cart.objects.exists())
        self.assertFalse(CartItem.objects.exists())

    def test_get_cart_creates_an_empty_cart(self):
        self.authenticate()

        response = self.client.get(self.cart_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(set(response.data), {"id", "items", "total"})
        self.assertEqual(response.data["items"], [])
        self.assertEqual(response.data["total"], "0.00")
        self.assertTrue(Cart.objects.filter(user=self.user).exists())

    def test_get_cart_returns_only_authenticated_users_items(self):
        own_cart = Cart.objects.create(user=self.user)
        CartItem.objects.create(cart=own_cart, game=self.game)
        other_cart = Cart.objects.create(user=self.other_user)
        CartItem.objects.create(cart=other_cart, game=self.second_game)
        self.authenticate()

        response = self.client.get(self.cart_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], own_cart.pk)
        self.assertEqual(
            [item["game"]["id"] for item in response.data["items"]],
            [self.game.pk],
        )
        self.assertEqual(response.data["total"], "19.99")

    def test_get_cart_calculates_total_and_orders_items(self):
        cart = Cart.objects.create(user=self.user)
        CartItem.objects.create(cart=cart, game=self.game)
        CartItem.objects.create(cart=cart, game=self.second_game)
        self.authenticate()

        response = self.client.get(self.cart_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total"], "25.00")
        self.assertEqual(
            [item["game"]["title"] for item in response.data["items"]],
            ["Cart Game", "Second Cart Game"],
        )

    def test_get_cart_returns_expected_nested_game_shape(self):
        cart = Cart.objects.create(user=self.user)
        CartItem.objects.create(cart=cart, game=self.game)
        self.authenticate()

        response = self.client.get(self.cart_url)

        item = response.data["items"][0]
        self.assertEqual(set(item), {"id", "game", "created_at"})
        self.assertEqual(
            set(item["game"]),
            {"id", "title", "price", "cover", "developer"},
        )
        self.assertEqual(item["game"]["price"], "19.99")
        self.assertEqual(item["game"]["developer"], "Cart Studio")
        self.assertEqual(
            item["game"]["cover"],
            "http://testserver/media/games/covers/2026/08/cart-game.webp",
        )

    def test_get_cart_uses_bounded_queries(self):
        cart = Cart.objects.create(user=self.user)
        CartItem.objects.create(cart=cart, game=self.game)
        CartItem.objects.create(cart=cart, game=self.second_game)
        self.authenticate()

        with self.assertNumQueries(3):
            response = self.client.get(self.cart_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["items"]), 2)

    def test_add_item_creates_cart_and_returns_updated_cart(self):
        self.authenticate()

        response = self.client.post(
            self.items_url,
            {"game_id": self.game.pk},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["total"], "19.99")
        self.assertEqual(len(response.data["items"]), 1)
        cart = Cart.objects.get(user=self.user)
        self.assertTrue(
            CartItem.objects.filter(cart=cart, game=self.game).exists(),
        )

    def test_add_item_reuses_the_users_existing_cart(self):
        cart = Cart.objects.create(user=self.user)
        self.authenticate()

        response = self.client.post(
            self.items_url,
            {"game_id": self.game.pk},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["id"], cart.pk)
        self.assertEqual(Cart.objects.filter(user=self.user).count(), 1)

    def test_add_item_rejects_invalid_or_unknown_game_id(self):
        self.authenticate()
        invalid_payloads = [
            {},
            {"game_id": ""},
            {"game_id": "not-an-id"},
            {"game_id": 999_999},
        ]

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                response = self.client.post(
                    self.items_url,
                    payload,
                    format="json",
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )

        self.assertFalse(CartItem.objects.exists())

    def test_add_item_rejects_duplicates(self):
        cart = Cart.objects.create(user=self.user)
        CartItem.objects.create(cart=cart, game=self.game)
        self.authenticate()

        response = self.client.post(
            self.items_url,
            {"game_id": self.game.pk},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("game_id", response.data)
        self.assertEqual(
            CartItem.objects.filter(cart=cart, game=self.game).count(),
            1,
        )

    def test_add_item_never_uses_another_users_cart(self):
        other_cart = Cart.objects.create(user=self.other_user)
        CartItem.objects.create(cart=other_cart, game=self.second_game)
        self.authenticate()

        response = self.client.post(
            self.items_url,
            {"game_id": self.game.pk},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        own_cart = Cart.objects.get(user=self.user)
        self.assertTrue(
            CartItem.objects.filter(cart=own_cart, game=self.game).exists(),
        )
        self.assertEqual(other_cart.items.count(), 1)
        self.assertTrue(
            other_cart.items.filter(game=self.second_game).exists(),
        )

    def test_delete_item_removes_game_from_own_cart(self):
        cart = Cart.objects.create(user=self.user)
        CartItem.objects.create(cart=cart, game=self.game)
        self.authenticate()

        response = self.client.delete(self.delete_url(self.game))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            CartItem.objects.filter(cart=cart, game=self.game).exists(),
        )

    def test_delete_item_returns_404_when_game_is_not_in_own_cart(self):
        Cart.objects.create(user=self.user)
        self.authenticate()

        response = self.client.delete(self.delete_url(self.game))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_item_cannot_remove_another_users_game(self):
        other_cart = Cart.objects.create(user=self.other_user)
        other_item = CartItem.objects.create(
            cart=other_cart,
            game=self.game,
        )
        self.authenticate()

        response = self.client.delete(self.delete_url(self.game))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(CartItem.objects.filter(pk=other_item.pk).exists())

    def test_cart_routes_reject_unsupported_methods(self):
        self.authenticate()
        responses = [
            self.client.post(self.cart_url, {}, format="json"),
            self.client.get(self.items_url),
            self.client.delete(self.items_url),
            self.client.get(self.delete_url(self.game)),
            self.client.post(
                self.delete_url(self.game),
                {},
                format="json",
            ),
        ]

        for response in responses:
            with self.subTest(
                method=response.request["REQUEST_METHOD"],
                path=response.request["PATH_INFO"],
            ):
                self.assertEqual(
                    response.status_code,
                    status.HTTP_405_METHOD_NOT_ALLOWED,
                )
