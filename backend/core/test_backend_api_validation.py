"""KAN-44 cross-domain validation and two-user permission coverage."""

from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from community.models import GameReview, GameWishlist
from games.models import Game
from store.models import (
    Cart,
    CartItem,
    LibraryCollection,
    LibraryItem,
    Order,
    OrderItem,
)


User = get_user_model()
PASSWORD = "Strong-KAN-44-password-2026!"


def create_user(username: str):
    return User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password=PASSWORD,
    )


def create_game(title: str, price: str = "19.99") -> Game:
    return Game.objects.create(
        title=title,
        description=f"Validation fixture for {title}.",
        price=Decimal(price),
        developer="KAN-44 Validation Studio",
        release_date=date(2026, 9, 10),
        requirements="8 GB RAM",
    )


def grant_purchase(user, game: Game, *, order_user=None):
    order = Order.objects.create(
        user=order_user or user,
        total_price=game.price,
        status=Order.Status.COMPLETED,
    )
    OrderItem.objects.create(
        order=order,
        game=game,
        price_at_purchase=game.price,
    )
    item = LibraryItem.objects.create(user=user, game=game, order=order)
    return order, item


class AuthValidationAPITests(APITestCase):
    register_url = reverse("users:register")
    token_url = reverse("users:token")
    refresh_url = reverse("users:token-refresh")
    profile_url = reverse("users:profile")

    def test_registration_requires_a_complete_payload_without_partial_users(self):
        payload = {
            "username": "kan44-register",
            "email": "kan44-register@example.com",
            "password": PASSWORD,
            "password_confirm": PASSWORD,
        }

        for missing_field in ("username", "email", "password", "password_confirm"):
            with self.subTest(missing_field=missing_field):
                invalid_payload = payload.copy()
                invalid_payload.pop(missing_field)
                response = self.client.post(
                    self.register_url,
                    invalid_payload,
                    format="json",
                )

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(missing_field, response.data)
                self.assertFalse(User.objects.exists())

    def test_login_and_refresh_reject_invalid_payloads_without_tokens(self):
        user = create_user("kan44-auth")

        missing_email = self.client.post(
            self.token_url,
            {"password": PASSWORD},
            format="json",
        )
        wrong_password = self.client.post(
            self.token_url,
            {"email": user.email, "password": "Wrong-password-2026!"},
            format="json",
        )
        missing_refresh = self.client.post(self.refresh_url, {}, format="json")
        invalid_refresh = self.client.post(
            self.refresh_url,
            {"refresh": "not-a-jwt"},
            format="json",
        )

        self.assertEqual(missing_email.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(wrong_password.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(missing_refresh.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(invalid_refresh.status_code, status.HTTP_401_UNAUTHORIZED)
        for response in (
            missing_email,
            wrong_password,
            missing_refresh,
            invalid_refresh,
        ):
            self.assertNotIn("access", response.data)
            self.assertFalse(
                isinstance(response.data.get("refresh"), str),
                "An invalid authentication response must not issue a refresh token.",
            )

    def test_profile_cannot_overwrite_security_or_summary_fields(self):
        user = create_user("kan44-profile")
        other_user = create_user("kan44-profile-other")
        self.client.force_authenticate(user=user)

        response = self.client.patch(
            self.profile_url,
            {
                "id": other_user.pk,
                "password": "Forged-password-2026!",
                "is_staff": True,
                "is_superuser": True,
                "display_name": "Forged Admin",
                "stats": {"library_games": 999},
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertNotEqual(user.pk, other_user.pk)
        self.assertTrue(user.check_password(PASSWORD))
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertEqual(response.data["id"], user.pk)
        self.assertEqual(response.data["stats"]["library_games"], 0)


class CommerceBoundaryValidationAPITests(APITestCase):
    def setUp(self):
        self.first_user = create_user("kan44-buyer-one")
        self.second_user = create_user("kan44-buyer-two")
        self.first_game = create_game("KAN-44 First Game", "24.99")
        self.second_game = create_game("KAN-44 Second Game", "7.50")

    def authenticate(self, user=None):
        self.client.force_authenticate(user=user or self.first_user)

    def test_checkout_uses_authenticated_cart_and_server_owned_order_fields(self):
        first_cart = Cart.objects.create(user=self.first_user)
        CartItem.objects.create(cart=first_cart, game=self.first_game)
        second_cart = Cart.objects.create(user=self.second_user)
        second_item = CartItem.objects.create(
            cart=second_cart,
            game=self.second_game,
        )
        self.authenticate()

        response = self.client.post(
            reverse("store:order-checkout"),
            {
                "user": self.second_user.pk,
                "status": Order.Status.CANCELLED,
                "total_price": "0.00",
                "items": [{"game": self.second_game.pk, "price": "0.00"}],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.user, self.first_user)
        self.assertEqual(order.status, Order.Status.COMPLETED)
        self.assertEqual(order.total_price, self.first_game.price)
        self.assertEqual(list(order.items.values_list("game_id", flat=True)), [self.first_game.pk])
        self.assertNotIn("user", response.data)
        self.assertTrue(CartItem.objects.filter(pk=second_item.pk).exists())
        self.assertFalse(Order.objects.filter(user=self.second_user).exists())

    def test_library_mutations_validate_input_and_preserve_ownership(self):
        first_order, first_item = grant_purchase(self.first_user, self.first_game)
        second_order, second_item = grant_purchase(self.second_user, self.second_game)
        first_url = reverse("store:library-item-update", args=[first_item.pk])
        second_url = reverse("store:library-item-update", args=[second_item.pk])
        self.authenticate()

        invalid = self.client.patch(
            first_url,
            {"is_favorite": "definitely-not-a-boolean"},
            format="json",
        )
        forged = self.client.patch(
            first_url,
            {
                "is_favorite": True,
                "user": self.second_user.pk,
                "game": self.second_game.pk,
                "order": second_order.pk,
            },
            format="json",
        )
        foreign = self.client.patch(
            second_url,
            {"is_favorite": True},
            format="json",
        )

        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(forged.status_code, status.HTTP_200_OK)
        self.assertEqual(foreign.status_code, status.HTTP_404_NOT_FOUND)
        first_item.refresh_from_db()
        second_item.refresh_from_db()
        self.assertTrue(first_item.is_favorite)
        self.assertEqual(first_item.user, self.first_user)
        self.assertEqual(first_item.game, self.first_game)
        self.assertEqual(first_item.order, first_order)
        self.assertFalse(second_item.is_favorite)

    def test_library_collections_are_owner_scoped_for_every_operation(self):
        first_collection = LibraryCollection.objects.create(
            user=self.first_user,
            name="First private collection",
        )
        second_collection = LibraryCollection.objects.create(
            user=self.second_user,
            name="Second private collection",
        )
        list_url = reverse("store:library-collections")
        foreign_url = reverse(
            "store:library-collection-detail",
            args=[second_collection.pk],
        )
        self.authenticate()

        listed = self.client.get(list_url)
        foreign_responses = (
            self.client.get(foreign_url),
            self.client.patch(foreign_url, {"name": "Hacked"}, format="json"),
            self.client.put(
                foreign_url,
                {"name": "Hacked", "game_ids": []},
                format="json",
            ),
            self.client.delete(foreign_url),
        )

        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in listed.data["items"]],
            [first_collection.pk],
        )
        for response in foreign_responses:
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        second_collection.refresh_from_db()
        self.assertEqual(second_collection.name, "Second private collection")

    def test_cross_user_order_link_never_counts_as_library_ownership(self):
        foreign_order, inconsistent_item = grant_purchase(
            self.first_user,
            self.first_game,
            order_user=self.second_user,
        )
        wishlist_item = GameWishlist.objects.create(
            user=self.first_user,
            game=self.first_game,
        )
        self.authenticate()

        library = self.client.get(reverse("store:library"))
        wishlist = self.client.get(reverse("community:wishlist"))
        favorite = self.client.patch(
            reverse("store:library-item-update", args=[inconsistent_item.pk]),
            {"is_favorite": True},
            format="json",
        )
        collection = self.client.post(
            reverse("store:library-collections"),
            {"name": "Invalid ownership", "game_ids": [self.first_game.pk]},
            format="json",
        )

        self.assertEqual(foreign_order.user, self.second_user)
        self.assertEqual(library.data, {"items": []})
        self.assertEqual(
            [item["id"] for item in wishlist.data["items"]],
            [wishlist_item.pk],
        )
        self.assertEqual(favorite.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(collection.status_code, status.HTTP_400_BAD_REQUEST)
        inconsistent_item.refresh_from_db()
        self.assertFalse(inconsistent_item.is_favorite)
        self.assertFalse(LibraryCollection.objects.filter(user=self.first_user).exists())


class WishlistReviewValidationAPITests(APITestCase):
    def setUp(self):
        self.first_user = create_user("kan44-community-one")
        self.second_user = create_user("kan44-community-two")
        self.wishlist_game = create_game("KAN-44 Wishlist Game", "9.99")
        self.review_game = create_game("KAN-44 Review Game", "14.99")
        self.other_game = create_game("KAN-44 Spoofed Game", "4.99")
        grant_purchase(self.first_user, self.review_game)
        grant_purchase(self.second_user, self.review_game)

    def authenticate(self, user=None):
        self.client.force_authenticate(user=user or self.first_user)

    def test_wishlist_payload_cannot_assign_an_item_to_another_user(self):
        self.authenticate()
        created = self.client.post(
            reverse("community:wishlist-item-create"),
            {"game_id": self.wishlist_game.pk, "user": self.second_user.pk},
            format="json",
        )

        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        item = GameWishlist.objects.get(pk=created.data["id"])
        self.assertEqual(item.user, self.first_user)

        self.authenticate(self.second_user)
        listed = self.client.get(reverse("community:wishlist"))
        foreign_delete = self.client.delete(
            reverse("community:wishlist-item-delete", args=[self.wishlist_game.pk]),
        )

        self.assertEqual(listed.data, {"items": []})
        self.assertEqual(foreign_delete.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(GameWishlist.objects.filter(pk=item.pk).exists())

    def test_review_payload_cannot_spoof_author_or_game(self):
        self.authenticate()
        response = self.client.post(
            reverse(
                "community:game-review-list",
                args=[self.review_game.pk],
            ),
            {
                "rating": 5,
                "body": "A validated KAN-44 review.",
                "user": self.second_user.pk,
                "author": {"id": self.second_user.pk},
                "game_id": self.other_game.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        review = GameReview.objects.get(pk=response.data["id"])
        self.assertEqual(review.user, self.first_user)
        self.assertEqual(review.game, self.review_game)
        self.assertEqual(response.data["author"]["id"], self.first_user.pk)
        self.assertEqual(response.data["game_id"], self.review_game.pk)

    def test_foreign_review_mutations_and_oversized_body_are_rejected(self):
        review = GameReview.objects.create(
            user=self.first_user,
            game=self.review_game,
            rating=4,
            body="Protected review body.",
        )
        url = reverse(
            "community:game-review-detail",
            args=[self.review_game.pk, review.pk],
        )
        self.authenticate(self.second_user)

        foreign_patch = self.client.patch(
            url,
            {"rating": 1, "body": "Tampered."},
            format="json",
        )
        foreign_delete = self.client.delete(url)

        self.authenticate()
        oversized = self.client.patch(
            url,
            {"body": "x" * 4001},
            format="json",
        )

        self.assertEqual(foreign_patch.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(foreign_delete.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(oversized.status_code, status.HTTP_400_BAD_REQUEST)
        review.refresh_from_db()
        self.assertEqual(review.rating, 4)
        self.assertEqual(review.body, "Protected review body.")
