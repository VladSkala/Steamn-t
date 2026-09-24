from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from users.models import WalletTransaction


class SettingsAndPublicProfileTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="settings_user", email="settings@example.test", password="StrongPass123!")
        self.client = APIClient()

    def test_public_profile_hides_email_and_private_sections(self):
        self.user.privacy_games = False
        self.user.privacy_wishlist = False
        self.user.save(update_fields=("privacy_games", "privacy_wishlist"))
        response = self.client.get(f"/api/users/{self.user.pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("email", response.data)
        self.assertNotIn("games", response.data)
        self.assertNotIn("wishlist", response.data)

    def test_wallet_topup_is_saved_and_transactions_are_immutable(self):
        self.client.force_authenticate(self.user)
        response = self.client.post("/api/settings/wallet/", {"amount": "25.00"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["balance"], "25.00")
        self.assertEqual(self.client.get("/api/settings/wallet/").data["balance"], "25.00")
        transaction = WalletTransaction.objects.get(user=self.user)
        with self.assertRaises(ValueError):
            transaction.save()

    def test_password_change_requires_current_password(self):
        session = self.client.post("/api/auth/token/", {"email": self.user.email, "password": "StrongPass123!"}, format="json").data
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.post("/api/settings/password/", {"current_password": "wrong", "new_password": "A-Better-Pass-123!"}, format="json").status_code, 400)
        response = self.client.post("/api/settings/password/", {"current_password": "StrongPass123!", "new_password": "A-Better-Pass-123!"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("A-Better-Pass-123!"))
        old_session_client = APIClient()
        old_session_client.credentials(HTTP_AUTHORIZATION=f"Bearer {session['access']}")
        self.assertEqual(old_session_client.get("/api/profile/").status_code, 401)
        self.assertEqual(old_session_client.post("/api/auth/token/refresh/", {"refresh": session["refresh"]}, format="json").status_code, 401)

    def test_profile_accepts_every_supported_interface_language(self):
        self.client.force_authenticate(self.user)

        for language in ("en", "ru", "uk"):
            response = self.client.patch(
                "/api/profile/", {"language": language}, format="json"
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["language"], language)

    def test_login_returns_the_complete_current_user_contract(self):
        self.user.dark_theme = False
        self.user.notification_preferences["message_sound"] = False
        self.user.save(update_fields=("dark_theme", "notification_preferences"))
        WalletTransaction.objects.create(
            user=self.user,
            amount="18.25",
            kind="topup",
            description="Login balance",
            event_key="login-balance",
        )

        response = self.client.post(
            "/api/auth/token/",
            {"email": self.user.email, "password": "StrongPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["user"]["dark_theme"])
        self.assertFalse(response.data["user"]["notification_preferences"]["message_sound"])
        self.assertEqual(response.data["user"]["wallet_balance"], "18.25")
        self.assertIn("stats", response.data["user"])
