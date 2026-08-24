from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken


User = get_user_model()


class UserModelTests(APITestCase):
    def test_create_user_with_email(self):
        user = User.objects.create_user(
            username="andrey",
            email="andrey@example.com",
            password="Safe-test-password-2026!",
        )

        self.assertEqual(user.username, "andrey")
        self.assertEqual(user.email, "andrey@example.com")
        self.assertTrue(user.check_password("Safe-test-password-2026!"))
        self.assertEqual(user.created_at, user.date_joined)
        self.assertEqual(str(user), "andrey")

    def test_email_must_be_unique(self):
        User.objects.create_user(
            username="first-user",
            email="shared@example.com",
            password="Safe-test-password-2026!",
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                User.objects.create_user(
                    username="second-user",
                    email="shared@example.com",
                    password="Safe-test-password-2026!",
                )


class RegistrationAPITests(APITestCase):
    url = reverse("users:register")

    def valid_payload(self, **overrides):
        payload = {
            "username": "new-player",
            "email": "New.Player@Example.com",
            "first_name": "New",
            "last_name": "Player",
            "password": "Strong-registration-password-2026!",
            "password_confirm": "Strong-registration-password-2026!",
        }
        payload.update(overrides)
        return payload

    def test_register_creates_user_and_returns_tokens(self):
        response = self.client.post(self.url, self.valid_payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertIn("user", response.data)
        self.assertNotIn("password", response.data)
        self.assertNotIn("password_confirm", response.data)

        user = User.objects.get(username="new-player")
        self.assertEqual(user.email, "new.player@example.com")
        self.assertTrue(user.check_password("Strong-registration-password-2026!"))

        access = AccessToken(response.data["access"])
        self.assertEqual(str(access["user_id"]), str(user.pk))
        self.assertEqual(access["username"], user.username)
        self.assertEqual(access["email"], user.email)

    def test_register_rejects_password_mismatch(self):
        response = self.client.post(
            self.url,
            self.valid_payload(password_confirm="Different-password-2026!"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password_confirm", response.data)
        self.assertFalse(User.objects.filter(username="new-player").exists())

    def test_register_rejects_weak_password(self):
        response = self.client.post(
            self.url,
            self.valid_payload(password="123", password_confirm="123"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_register_rejects_duplicate_email_case_insensitively(self):
        User.objects.create_user(
            username="existing-player",
            email="player@example.com",
            password="Strong-existing-password-2026!",
        )

        response = self.client.post(
            self.url,
            self.valid_payload(email="PLAYER@EXAMPLE.COM"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_register_rejects_duplicate_username_case_insensitively(self):
        User.objects.create_user(
            username="New-Player",
            email="existing@example.com",
            password="Strong-existing-password-2026!",
        )

        response = self.client.post(self.url, self.valid_payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.data)


class TokenAPITests(APITestCase):
    token_url = reverse("users:token")
    refresh_url = reverse("users:token-refresh")

    def setUp(self):
        self.password = "Strong-login-password-2026!"
        self.user = User.objects.create_user(
            username="token-player",
            email="Token.Player@Example.com",
            first_name="Token",
            password=self.password,
        )

    def login(self, **overrides):
        payload = {
            "email": "token.player@example.com",
            "password": self.password,
        }
        payload.update(overrides)
        return self.client.post(self.token_url, payload, format="json")

    def test_login_by_email_returns_access_refresh_and_user(self):
        response = self.login()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["id"], self.user.pk)
        self.assertEqual(response.data["user"]["email"], self.user.email)

    def test_login_email_is_case_insensitive(self):
        response = self.login(email="TOKEN.PLAYER@EXAMPLE.COM")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_login_rejects_wrong_password(self):
        response = self.login(password="Wrong-password-2026!")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn("access", response.data)

    def test_login_rejects_inactive_user(self):
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])

        response = self.login()

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_issues_new_access_token(self):
        login_response = self.login()

        response = self.client.post(
            self.refresh_url,
            {"refresh": login_response.data["refresh"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)


class ProfileAPITests(APITestCase):
    profile_url = reverse("users:profile")
    token_url = reverse("users:token")

    def setUp(self):
        self.password = "Strong-profile-password-2026!"
        self.user = User.objects.create_user(
            username="profile-player",
            email="profile@example.com",
            first_name="Profile",
            last_name="Player",
            password=self.password,
        )

    def authenticate(self):
        response = self.client.post(
            self.token_url,
            {"email": self.user.email, "password": self.password},
            format="json",
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {response.data['access']}"
        )

    def test_profile_requires_authentication(self):
        response = self.client.get(self.profile_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_returns_current_user(self):
        self.authenticate()

        response = self.client.get(self.profile_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.user.pk)
        self.assertEqual(response.data["username"], self.user.username)
        self.assertEqual(response.data["email"], self.user.email)
        self.assertIn("created_at", response.data)

    def test_profile_patch_updates_allowed_fields(self):
        self.authenticate()

        response = self.client.patch(
            self.profile_url,
            {
                "username": "updated-player",
                "email": "UPDATED@EXAMPLE.COM",
                "first_name": "Updated",
                "last_name": "Name",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "updated-player")
        self.assertEqual(self.user.email, "updated@example.com")
        self.assertEqual(self.user.first_name, "Updated")
        self.assertEqual(self.user.last_name, "Name")

    def test_profile_rejects_duplicate_email_case_insensitively(self):
        User.objects.create_user(
            username="other-player",
            email="other@example.com",
            password="Strong-other-password-2026!",
        )
        self.authenticate()

        response = self.client.patch(
            self.profile_url,
            {"email": "OTHER@EXAMPLE.COM"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_profile_rejects_invalid_access_token(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer not-a-valid-token")

        response = self.client.get(self.profile_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
