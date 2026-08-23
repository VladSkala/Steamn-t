from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase


User = get_user_model()


class UserModelTests(TestCase):
    def test_create_user_with_email(self):
        user = User.objects.create_user(
            username="andrey",
            email="andrey@example.com",
            password="safe-test-password",
        )

        self.assertEqual(user.username, "andrey")
        self.assertEqual(user.email, "andrey@example.com")
        self.assertTrue(user.check_password("safe-test-password"))
        self.assertEqual(user.created_at, user.date_joined)
        self.assertEqual(str(user), "andrey")

    def test_email_must_be_unique(self):
        User.objects.create_user(
            username="first-user",
            email="shared@example.com",
            password="safe-test-password",
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                User.objects.create_user(
                    username="second-user",
                    email="shared@example.com",
                    password="safe-test-password",
                )
