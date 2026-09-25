from django.contrib import admin
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from chat.models import ConversationPreference
from store.models import BundlePurchase, CartDLCItem, LibraryDLCItem, Order, OrderDLCItem
from users.models import (
    Notification,
    ProfileComment,
    UserBadge,
    UserBlock,
    WalletTransaction,
)


class AdminCoverageTests(TestCase):
    def setUp(self):
        self.superuser = get_user_model().objects.create_superuser(
            username="admin", email="admin@example.test", password="StrongAdminPassword2026!"
        )
        self.client.force_login(self.superuser)

    def test_new_sections_are_registered_and_open_for_superuser(self):
        models = (
            get_user_model(), UserBlock, UserBadge, ProfileComment,
            Notification, WalletTransaction, CartDLCItem, OrderDLCItem,
            BundlePurchase, LibraryDLCItem, ConversationPreference,
        )
        for model in models:
            with self.subTest(model=model.__name__):
                self.assertIn(model, admin.site._registry)
                url = reverse(f"admin:{model._meta.app_label}_{model._meta.model_name}_changelist")
                self.assertEqual(self.client.get(url).status_code, 200)

    def test_user_can_be_created_and_edited_through_admin(self):
        add_url = reverse("admin:users_user_add")
        self.assertEqual(self.client.get(add_url).status_code, 200)
        response = self.client.post(add_url, {
            "username": "qa_admin_created",
            "email": "qa-admin-created@example.test",
            "password1": "StrongNewPassword2026!",
            "password2": "StrongNewPassword2026!",
            "_save": "Save",
        })
        self.assertEqual(response.status_code, 302)
        user = get_user_model().objects.get(username="qa_admin_created")
        self.assertEqual(user.email, "qa-admin-created@example.test")
        self.assertTrue(user.check_password("StrongNewPassword2026!"))
        self.assertEqual(
            self.client.get(reverse("admin:users_user_change", args=(user.pk,))).status_code,
            200,
        )

    def test_financial_records_can_be_viewed_but_not_mutated_in_admin(self):
        wallet = WalletTransaction.objects.create(
            user=self.superuser,
            amount="25.00",
            kind="topup",
            description="Test top-up",
            event_key="admin-test:topup",
        )
        order = Order.objects.create(user=self.superuser, total_price="10.00", status="completed")
        for model, obj in ((WalletTransaction, wallet), (Order, order)):
            with self.subTest(model=model.__name__):
                prefix = f"admin:{model._meta.app_label}_{model._meta.model_name}"
                self.assertEqual(
                    self.client.get(reverse(f"{prefix}_change", args=(obj.pk,))).status_code,
                    200,
                )
                self.assertEqual(self.client.get(reverse(f"{prefix}_add")).status_code, 403)
                self.assertEqual(
                    self.client.post(reverse(f"{prefix}_change", args=(obj.pk,)), {"_save": "Save"}).status_code,
                    403,
                )
                self.assertEqual(
                    self.client.get(reverse(f"{prefix}_delete", args=(obj.pk,))).status_code,
                    403,
                )
        wallet.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(str(wallet.amount), "25.00")
        self.assertEqual(order.status, "completed")
