from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from community.models import (
    CommunityPost,
    GameReview,
    GameWishlist,
    PostComment,
    PostReaction,
    UserFollow,
)
from games.models import Game
from store.models import LibraryItem, Order, OrderItem


User = get_user_model()


class LibraryCommunityAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="library-user",
            email="library-user@example.com",
            password="StrongPass123!",
        )
        self.friend = User.objects.create_user(
            username="followed-friend",
            email="followed-friend@example.com",
            password="StrongPass123!",
        )
        self.other = User.objects.create_user(
            username="other-user",
            email="other-user@example.com",
            password="StrongPass123!",
        )
        self.game = Game.objects.create(
            title="Owned Odyssey",
            description="A complete library experience.",
            price=Decimal("24.99"),
            developer="Steamnt Studio",
            release_date=date(2026, 8, 1),
            hero_image_url="https://example.com/owned-odyssey-hero.jpg",
            download_url="https://example.com/downloads/owned-odyssey.zip",
            disk_size_gb=Decimal("12.50"),
        )
        self.unowned_game = Game.objects.create(
            title="Unowned Journey",
            description="Not in the current user's library.",
            price=Decimal("9.99"),
            developer="Other Studio",
            release_date=date(2026, 8, 2),
        )
        self.item = self.grant_game(self.user, self.game)
        self.client.force_authenticate(self.user)

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

    def create_post(self, *, kind=CommunityPost.Kind.COMMUNITY, game=None, author=None):
        return CommunityPost.objects.create(
            author=author or self.friend,
            game=self.game if game is None else game,
            kind=kind,
            title=f"{kind.title()} for the library",
            body="A real database-backed post.",
        )

    def test_library_home_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(reverse("community:library-home"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_library_home_returns_expanded_items_collections_and_posts(self):
        news = self.create_post(kind=CommunityPost.Kind.NEWS)
        community = self.create_post(kind=CommunityPost.Kind.SCREENSHOT)
        self.create_post(kind=CommunityPost.Kind.NEWS, game=self.unowned_game)

        response = self.client.get(reverse("community:library-home"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["items"]), 1)
        item = response.data["items"][0]
        self.assertEqual(item["game"]["download_url"], self.game.download_url)
        self.assertEqual(item["game"]["disk_size_gb"], "12.50")
        self.assertEqual([post["id"] for post in response.data["news"]], [news.pk])
        self.assertEqual(
            [post["id"] for post in response.data["community"]],
            [community.pk],
        )
        self.assertEqual(response.data["collections"], [])

    def test_library_game_is_owner_only_and_has_social_context(self):
        self.grant_game(self.friend, self.game)
        UserFollow.objects.create(follower=self.user, following=self.friend)
        GameWishlist.objects.create(user=self.friend, game=self.game)
        news = self.create_post(kind=CommunityPost.Kind.NEWS)

        response = self.client.get(
            reverse("community:library-game", args=[self.game.pk]),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["game"]["id"], self.game.pk)
        self.assertEqual(response.data["library_item"]["id"], self.item.pk)
        self.assertEqual(response.data["news"][0]["id"], news.pk)
        self.assertEqual(response.data["friends_own"][0]["id"], self.friend.pk)
        self.assertEqual(response.data["friends_want"][0]["id"], self.friend.pk)

        forbidden = self.client.get(
            reverse("community:library-game", args=[self.unowned_game.pk]),
        )
        self.assertEqual(forbidden.status_code, status.HTTP_404_NOT_FOUND)

    def test_review_can_be_created_updated_and_deleted_for_owned_game(self):
        url = reverse("community:game-review", args=[self.game.pk])

        created = self.client.post(
            url,
            {"rating": 4, "body": "A strong first review."},
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(GameReview.objects.get().user, self.user)

        updated = self.client.patch(
            url,
            {"rating": 5, "body": "Even better after another session."},
            format="json",
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(GameReview.objects.get().rating, 5)

        deleted = self.client.delete(url)
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(GameReview.objects.exists())

    def test_review_rejects_unowned_game(self):
        response = self.client.post(
            reverse("community:game-review", args=[self.unowned_game.pk]),
            {"rating": 5, "body": "Should not be accepted."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_feed_supports_recommended_library_and_following_tabs(self):
        followed_post = self.create_post(author=self.friend)
        other_post = self.create_post(author=self.other, game=self.unowned_game)
        UserFollow.objects.create(follower=self.user, following=self.friend)

        following = self.client.get(
            reverse("community:library-feed"),
            {"tab": "following", "ordering": "latest"},
        )
        self.assertEqual(following.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [post["id"] for post in following.data["items"]],
            [followed_post.pk],
        )

        library = self.client.get(
            reverse("community:library-feed"),
            {"tab": "library", "ordering": "latest"},
        )
        self.assertEqual(
            [post["id"] for post in library.data["items"]],
            [followed_post.pk],
        )

        recommended = self.client.get(
            reverse("community:library-feed"),
            {"tab": "recommended", "ordering": "latest"},
        )
        self.assertEqual(
            {post["id"] for post in recommended.data["items"]},
            {followed_post.pk, other_post.pk},
        )

    def test_feed_search_and_kind_filter_are_applied(self):
        matched = CommunityPost.objects.create(
            author=self.friend,
            game=self.game,
            kind=CommunityPost.Kind.GUIDE,
            title="Hidden route guide",
            body="Find every route.",
        )
        self.create_post(kind=CommunityPost.Kind.NEWS)

        response = self.client.get(
            reverse("community:library-feed"),
            {
                "tab": "recommended",
                "ordering": "latest",
                "kind": "guide",
                "search": "hidden route",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [post["id"] for post in response.data["items"]],
            [matched.pk],
        )

    def test_reaction_endpoint_toggles_one_user_like(self):
        post = self.create_post()
        url = reverse("community:post-reaction", args=[post.pk])

        liked = self.client.post(url, {}, format="json")
        self.assertEqual(liked.status_code, status.HTTP_200_OK)
        self.assertTrue(liked.data["is_liked"])
        self.assertEqual(liked.data["like_count"], 1)
        self.assertTrue(PostReaction.objects.filter(post=post, user=self.user).exists())

        unliked = self.client.post(url, {}, format="json")
        self.assertFalse(unliked.data["is_liked"])
        self.assertEqual(unliked.data["like_count"], 0)

    def test_comments_can_be_created_and_listed(self):
        post = self.create_post()
        url = reverse("community:post-comments", args=[post.pk])

        created = self.client.post(url, {"body": "Useful post."}, format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PostComment.objects.get().author, self.user)

        listed = self.client.get(url)
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(listed.data["items"][0]["body"], "Useful post.")

    def test_wishlist_endpoint_toggles_state_for_owned_game(self):
        url = reverse("community:game-wishlist", args=[self.game.pk])
        added = self.client.post(url, {}, format="json")
        self.assertTrue(added.data["is_wishlisted"])
        self.assertTrue(GameWishlist.objects.filter(user=self.user, game=self.game).exists())

        removed = self.client.post(url, {}, format="json")
        self.assertFalse(removed.data["is_wishlisted"])
        self.assertFalse(GameWishlist.objects.filter(user=self.user, game=self.game).exists())
