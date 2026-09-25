from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from community.models import CommunityPost, PostComment, PostReaction
from games.models import Game
from store.models import LibraryItem, Order, OrderItem


User = get_user_model()


class CommunityPostsApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="post_owner", email="owner@example.invalid", password="Test-pass-1")
        self.other = User.objects.create_user(username="post_other", email="other@example.invalid", password="Test-pass-2")
        self.game = Game.objects.create(title="Owned QA game", developer="QA", description="QA", price="9.99", release_date="2026-01-01")
        order = Order.objects.create(user=self.owner, status=Order.Status.COMPLETED, total_price="9.99")
        OrderItem.objects.create(order=order, game=self.game, price_at_purchase="9.99")
        LibraryItem.objects.create(
            user=self.owner,
            game=self.game,
            order=order,
            price_at_purchase="9.99",
        )
        self.post = CommunityPost.objects.create(author=self.owner, game=self.game, kind=CommunityPost.Kind.COMMUNITY, title="Public post", body="Stored body")

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def test_anonymous_can_list_read_and_view_comments_without_private_fields(self):
        PostComment.objects.create(post=self.post, author=self.other, body="Public comment")
        listing = self.client.get("/api/community/posts/")
        detail = self.client.get(f"/api/community/posts/{self.post.pk}/")
        comments = self.client.get(f"/api/library/posts/{self.post.pk}/comments/")
        self.assertEqual((listing.status_code, detail.status_code, comments.status_code), (200, 200, 200))
        self.assertNotIn("email", listing.data["items"][0]["author"])
        self.assertEqual(comments.data["items"][0]["body"], "Public comment")

    def test_anonymous_cannot_create_react_or_comment(self):
        self.assertEqual(self.client.post("/api/community/posts/", {"kind": "community", "title": "No", "body": "No"}).status_code, 401)
        self.assertEqual(self.client.post(f"/api/library/posts/{self.post.pk}/reaction/").status_code, 401)
        self.assertEqual(self.client.post(f"/api/library/posts/{self.post.pk}/comments/", {"body": "No"}).status_code, 401)

    def test_create_binds_author_and_persists_after_get(self):
        self.auth(self.owner)
        response = self.client.post("/api/community/posts/", {"kind": "guide", "title": " Guide ", "body": " Body ", "game_id": self.game.pk, "author": self.other.pk}, format="json")
        self.assertEqual(response.status_code, 201)
        created = CommunityPost.objects.get(pk=response.data["id"])
        self.assertEqual(created.author, self.owner)
        self.assertEqual(self.client.get(f"/api/community/posts/{created.pk}/").data["body"], "Body")

    def test_cannot_associate_unowned_game(self):
        other_game = Game.objects.create(title="Not owned", developer="QA", description="QA", price="1.00", release_date="2026-01-01")
        self.auth(self.owner)
        response = self.client.post("/api/community/posts/", {"kind": "community", "title": "Title", "body": "Body", "game_id": other_game.pk}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(CommunityPost.objects.count(), 1)

    def test_only_owner_can_update_or_delete(self):
        self.auth(self.other)
        self.assertEqual(self.client.patch(f"/api/community/posts/{self.post.pk}/", {"title": "Stolen"}, format="json").status_code, 403)
        self.assertEqual(self.client.delete(f"/api/community/posts/{self.post.pk}/").status_code, 403)
        self.auth(self.owner)
        updated = self.client.patch(f"/api/community/posts/{self.post.pk}/", {"title": "Updated"}, format="json")
        self.assertEqual(updated.status_code, 200)
        self.assertTrue(updated.data["is_owner"])
        self.assertEqual(self.client.delete(f"/api/community/posts/{self.post.pk}/").status_code, 204)

    def test_reaction_toggle_never_duplicates(self):
        self.auth(self.other)
        first = self.client.post(f"/api/library/posts/{self.post.pk}/reaction/")
        second = self.client.post(f"/api/library/posts/{self.post.pk}/reaction/")
        third = self.client.post(f"/api/library/posts/{self.post.pk}/reaction/")
        self.assertEqual((first.data["is_liked"], second.data["is_liked"], third.data["is_liked"]), (True, False, True))
        self.assertEqual(PostReaction.objects.filter(post=self.post, user=self.other).count(), 1)

    def test_comment_validation_and_persistence(self):
        self.auth(self.other)
        self.assertEqual(self.client.post(f"/api/library/posts/{self.post.pk}/comments/", {"body": "   "}, format="json").status_code, 400)
        created = self.client.post(f"/api/library/posts/{self.post.pk}/comments/", {"body": " Stored comment "}, format="json")
        self.assertEqual(created.status_code, 201)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(f"/api/library/posts/{self.post.pk}/comments/").data["items"][0]["body"], "Stored comment")

    def test_comment_list_is_paginated_without_changing_the_items_contract(self):
        PostComment.objects.bulk_create([
            PostComment(post=self.post, author=self.other, body=f"Comment {index}")
            for index in range(55)
        ])

        response = self.client.get(f"/api/library/posts/{self.post.pk}/comments/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 55)
        self.assertEqual(len(response.data["items"]), 50)
        self.assertIsNotNone(response.data["next"])

    def test_list_ordering_and_filters_are_deterministic(self):
        newer = CommunityPost.objects.create(author=self.other, kind=CommunityPost.Kind.GUIDE, title="Newest", body="Guide")
        CommunityPost.objects.filter(pk=newer.pk).update(created_at=timezone.now())
        response = self.client.get("/api/community/posts/?ordering=latest&kind=all")
        self.assertEqual([item["id"] for item in response.data["items"]][:2], [newer.pk, self.post.pk])
        filtered = self.client.get("/api/community/posts/?kind=guide&search=Newest")
        self.assertEqual([item["id"] for item in filtered.data["items"]], [newer.pk])

    def test_list_returns_404_for_unknown_numeric_game_filter(self):
        response = self.client.get("/api/community/posts/?game=999999")

        self.assertEqual(response.status_code, 404)

    def test_list_rejects_non_numeric_game_filter(self):
        response = self.client.get("/api/community/posts/?game=not-a-game")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], "Invalid game id.")

    def test_protected_scopes_require_authentication(self):
        for scope in ("friends", "mine", "library"):
            self.assertEqual(self.client.get(f"/api/community/posts/?scope={scope}").status_code, 401)

    def test_missing_or_deleted_post_returns_404(self):
        post_id = self.post.pk
        self.post.delete()
        self.assertEqual(self.client.get(f"/api/community/posts/{post_id}/").status_code, 404)
        self.assertEqual(self.client.post(f"/api/library/posts/{post_id}/reaction/").status_code, 401)
