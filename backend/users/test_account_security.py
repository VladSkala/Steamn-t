from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from urllib.parse import urlparse, parse_qs
from .models import UserBlock


@override_settings(MAILERS={"default": {"BACKEND": "django.core.mail.backends.locmem.EmailBackend"}})
class AccountSecurityTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.alice = User.objects.create_user(username="alice_security", email="alice_security@example.test", password="Qp6!LongPassword")
        self.bob = User.objects.create_user(username="bob_security", email="bob_security@example.test", password="Qp6!LongPassword")
        self.client = APIClient()

    def test_recovery_is_single_use_and_does_not_disclose_accounts(self):
        known = self.client.post("/api/auth/password-reset/", {"email": self.alice.email})
        unknown = self.client.post("/api/auth/password-reset/", {"email": "missing@example.test"})
        self.assertEqual(known.data, unknown.data)
        self.assertEqual(len(mail.outbox), 1)
        url = next(line for line in mail.outbox[0].body.splitlines() if line.startswith("http"))
        params = {key: value[0] for key, value in parse_qs(urlparse(url).query).items()}
        params["password"] = "NewQp6!LongPassword"
        self.assertEqual(self.client.post("/api/auth/password-reset/confirm/", params).status_code, 200)
        self.assertEqual(self.client.post("/api/auth/password-reset/confirm/", params).status_code, 400)
        self.alice.refresh_from_db()
        self.assertEqual(self.alice.token_version, 1)
        self.assertTrue(self.alice.check_password(params["password"]))

    def test_block_stops_friend_requests_and_follow_and_unblocks(self):
        self.client.force_authenticate(self.alice)
        self.assertEqual(self.client.post(f"/api/users/{self.bob.pk}/block/").status_code, 200)
        self.client.force_authenticate(self.bob)
        self.assertEqual(self.client.post("/api/friends/requests/", {"user_id": self.alice.pk}).status_code, 403)
        self.assertEqual(self.client.post(f"/api/users/{self.alice.pk}/social/").status_code, 403)
        self.client.force_authenticate(self.alice)
        self.assertEqual(self.client.get("/api/blocks/").data["items"][0]["id"], self.bob.pk)
        self.client.delete(f"/api/users/{self.bob.pk}/block/")
        self.assertFalse(UserBlock.objects.exists())

    def test_private_activity_is_not_in_public_profile(self):
        self.alice.privacy_activity = False
        self.alice.save(update_fields=("privacy_activity",))
        data = self.client.get(f"/api/users/{self.alice.pk}/").data
        self.assertNotIn("posts", data)
        self.assertIsNone(data["stats"]["posts"])

    def test_public_profile_lists_followers_and_following(self):
        from community.models import UserFollow

        User = get_user_model()
        carol = User.objects.create_user(username="carol_security", email="carol_security@example.test", password="Qp6!LongPassword")
        UserFollow.objects.create(follower=self.bob, following=self.alice)
        UserFollow.objects.create(follower=self.alice, following=carol)

        followers = self.client.get(f"/api/users/{self.alice.pk}/content/?section=followers")
        following = self.client.get(f"/api/users/{self.alice.pk}/content/?section=following")

        self.assertEqual(followers.status_code, 200)
        self.assertEqual([item["id"] for item in followers.data["results"]], [self.bob.pk])
        self.assertEqual(following.status_code, 200)
        self.assertEqual([item["id"] for item in following.data["results"]], [carol.pk])
