from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from community.models import CommunityPost, Friendship, UserFollow


User = get_user_model()


def make_friendship(first, second, *, requested_by, status=Friendship.Status.PENDING):
    low, high = sorted((first, second), key=lambda user: user.pk)
    return Friendship.objects.create(
        user_low=low,
        user_high=high,
        requested_by=requested_by,
        status=status,
        responded_at=timezone.now() if status == Friendship.Status.ACCEPTED else None,
    )


class FriendsApiTests(APITestCase):
    def setUp(self):
        self.alex = User.objects.create_user(
            username="alex_qa",
            email="alex.private@example.invalid",
            password="Test-pass-1",
            first_name="Alex",
        )
        self.blair = User.objects.create_user(
            username="blair_qa",
            email="blair.private@example.invalid",
            password="Test-pass-2",
            first_name="Blair",
        )
        self.casey = User.objects.create_user(
            username="casey_qa",
            email="casey.private@example.invalid",
            password="Test-pass-3",
            first_name="Casey",
        )
        self.drew = User.objects.create_user(
            username="drew_qa",
            email="drew.private@example.invalid",
            password="Test-pass-4",
            first_name="Drew",
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def send_request(self, sender, recipient):
        self.authenticate(sender)
        return self.client.post(
            "/api/friends/requests/",
            {"user_id": recipient.pk},
            format="json",
        )

    def test_search_excludes_self_and_private_account_fields(self):
        self.authenticate(self.alex)
        response = self.client.get("/api/friends/search/?q=_qa")
        self.assertEqual(response.status_code, 200)
        usernames = [item["username"] for item in response.data["items"]]
        self.assertEqual(usernames, ["blair_qa", "casey_qa", "drew_qa"])
        self.assertNotIn("email", response.data["items"][0])
        self.assertNotIn("is_staff", response.data["items"][0])
        self.assertEqual(response.data["items"][0]["relationship_status"], "none")

    def test_short_search_returns_deterministic_empty_list(self):
        self.authenticate(self.alex)
        response = self.client.get("/api/friends/search/?q=a")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"items": []})

    def test_send_request_creates_one_canonical_pending_pair(self):
        response = self.send_request(self.alex, self.blair)
        self.assertEqual(response.status_code, 201)
        relationship = Friendship.objects.get()
        self.assertEqual(
            (relationship.user_low_id, relationship.user_high_id),
            tuple(sorted((self.alex.pk, self.blair.pk))),
        )
        self.assertEqual(relationship.requested_by, self.alex)
        self.assertEqual(response.data["relationship_status"], "outgoing")

    def test_self_request_is_rejected_without_creating_row(self):
        response = self.send_request(self.alex, self.alex)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Friendship.objects.count(), 0)

    def test_duplicate_and_reverse_pending_requests_are_rejected(self):
        first = self.send_request(self.alex, self.blair)
        duplicate = self.send_request(self.alex, self.blair)
        reverse = self.send_request(self.blair, self.alex)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(reverse.status_code, 400)
        self.assertEqual(Friendship.objects.count(), 1)

    def test_already_friends_request_is_rejected(self):
        make_friendship(
            self.alex,
            self.blair,
            requested_by=self.alex,
            status=Friendship.Status.ACCEPTED,
        )
        response = self.send_request(self.alex, self.blair)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Friendship.objects.count(), 1)

    def test_only_recipient_can_accept_and_friendship_is_symmetric(self):
        request_response = self.send_request(self.alex, self.blair)
        request_id = request_response.data["id"]
        sender_attempt = self.client.post(
            f"/api/friends/requests/{request_id}/accept/", {}, format="json"
        )
        self.assertEqual(sender_attempt.status_code, 403)
        self.authenticate(self.blair)
        accepted = self.client.post(
            f"/api/friends/requests/{request_id}/accept/", {}, format="json"
        )
        self.assertEqual(accepted.status_code, 200)
        self.assertEqual(accepted.data["relationship_status"], "friend")
        self.authenticate(self.alex)
        alex_overview = self.client.get("/api/friends/")
        self.authenticate(self.blair)
        blair_overview = self.client.get("/api/friends/")
        self.assertEqual(alex_overview.data["friends"][0]["user"]["id"], self.blair.pk)
        self.assertEqual(blair_overview.data["friends"][0]["user"]["id"], self.alex.pk)

    def test_recipient_can_reject_and_sender_cannot(self):
        request_id = self.send_request(self.alex, self.blair).data["id"]
        sender_attempt = self.client.post(
            f"/api/friends/requests/{request_id}/reject/", {}, format="json"
        )
        self.assertEqual(sender_attempt.status_code, 403)
        self.authenticate(self.blair)
        response = self.client.post(
            f"/api/friends/requests/{request_id}/reject/", {}, format="json"
        )
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Friendship.objects.exists())

    def test_sender_can_cancel_and_recipient_cannot(self):
        request_id = self.send_request(self.alex, self.blair).data["id"]
        self.authenticate(self.blair)
        recipient_attempt = self.client.post(
            f"/api/friends/requests/{request_id}/cancel/", {}, format="json"
        )
        self.assertEqual(recipient_attempt.status_code, 403)
        self.authenticate(self.alex)
        response = self.client.post(
            f"/api/friends/requests/{request_id}/cancel/", {}, format="json"
        )
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Friendship.objects.exists())

    def test_either_participant_can_remove_an_accepted_friend(self):
        make_friendship(
            self.alex,
            self.blair,
            requested_by=self.alex,
            status=Friendship.Status.ACCEPTED,
        )
        self.authenticate(self.blair)
        response = self.client.delete(f"/api/friends/{self.alex.pk}/")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Friendship.objects.exists())

    def test_third_party_cannot_mutate_another_users_request(self):
        request_id = self.send_request(self.alex, self.blair).data["id"]
        self.authenticate(self.casey)
        for action in ("accept", "reject", "cancel"):
            response = self.client.post(
                f"/api/friends/requests/{request_id}/{action}/", {}, format="json"
            )
            self.assertEqual(response.status_code, 403)
        self.assertTrue(Friendship.objects.filter(pk=request_id).exists())

    def test_anonymous_friend_endpoints_are_protected(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/friends/").status_code, 401)
        self.assertEqual(self.client.get("/api/friends/search/?q=alex").status_code, 401)
        self.assertEqual(
            self.client.post(
                "/api/friends/requests/", {"user_id": self.blair.pk}, format="json"
            ).status_code,
            401,
        )

    def test_overview_lists_are_grouped_and_sorted_by_username(self):
        make_friendship(
            self.alex,
            self.drew,
            requested_by=self.alex,
            status=Friendship.Status.ACCEPTED,
        )
        make_friendship(
            self.alex,
            self.blair,
            requested_by=self.blair,
            status=Friendship.Status.PENDING,
        )
        make_friendship(
            self.alex,
            self.casey,
            requested_by=self.alex,
            status=Friendship.Status.PENDING,
        )
        self.authenticate(self.alex)
        response = self.client.get("/api/friends/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["user"]["username"] for item in response.data["friends"]], ["drew_qa"])
        self.assertEqual([item["user"]["username"] for item in response.data["incoming"]], ["blair_qa"])
        self.assertEqual([item["user"]["username"] for item in response.data["outgoing"]], ["casey_qa"])

    def test_relationship_state_persists_across_repeated_gets(self):
        request_id = self.send_request(self.alex, self.blair).data["id"]
        self.authenticate(self.blair)
        self.client.post(f"/api/friends/requests/{request_id}/accept/", {}, format="json")
        first = self.client.get("/api/friends/")
        self.client.force_authenticate(user=None)
        self.authenticate(self.blair)
        second = self.client.get("/api/friends/")
        self.assertEqual(first.data, second.data)
        self.assertEqual(Friendship.objects.get().status, Friendship.Status.ACCEPTED)

    def test_friendship_and_follow_drive_separate_feed_scopes(self):
        make_friendship(
            self.alex,
            self.blair,
            requested_by=self.alex,
            status=Friendship.Status.ACCEPTED,
        )
        post = CommunityPost.objects.create(
            author=self.blair,
            title="Friend activity",
            body="Database-backed activity",
            kind=CommunityPost.Kind.COMMUNITY,
        )
        CommunityPost.objects.create(
            author=self.casey,
            title="Unrelated activity",
            body="Should not appear",
            kind=CommunityPost.Kind.COMMUNITY,
        )
        self.authenticate(self.alex)
        response = self.client.get(
            "/api/library/feed/?tab=following&kind=all&ordering=latest"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["items"], [])

        friends_response = self.client.get(
            "/api/community/posts/?scope=friends&kind=all&ordering=latest"
        )
        self.assertEqual(
            [item["id"] for item in friends_response.data["items"]],
            [post.pk],
        )

        UserFollow.objects.create(follower=self.alex, following=self.blair)
        response = self.client.get(
            "/api/library/feed/?tab=following&kind=all&ordering=latest"
        )
        self.assertEqual([item["id"] for item in response.data["items"]], [post.pk])
