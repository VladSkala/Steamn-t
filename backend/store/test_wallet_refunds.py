from datetime import date, timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from games.models import Game, DLC
from store.models import Cart, CartItem, LibraryItem, Order, LibraryDLCItem
from users.models import WalletTransaction
from users.wallet_services import wallet_balance


class WalletRefundTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="buyer_refund", email="buyer_refund@example.test", password="SecureRefund123!")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.game = Game.objects.create(title="Wallet game", description="A game", price="12.50", developer="Studio", release_date=date(2025, 1, 1))
        self.cart = Cart.objects.create(user=self.user)
        CartItem.objects.create(cart=self.cart, game=self.game)

    def test_insufficient_balance_rolls_back_every_checkout_write(self):
        response = self.client.post("/api/orders/checkout/", {"payment_method": "wallet"})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Order.objects.exists())
        self.assertFalse(LibraryItem.objects.exists())
        self.assertEqual(CartItem.objects.count(), 1)
        self.assertFalse(WalletTransaction.objects.exists())

    def test_wallet_purchase_refund_is_idempotent_and_preserves_receipt(self):
        self.client.post("/api/settings/wallet/", {"amount": "25.00"})
        result = self.client.post("/api/orders/checkout/", {"payment_method": "wallet"})
        self.assertEqual(result.status_code, 201)
        self.assertEqual(wallet_balance(self.user), Decimal("12.50"))
        order_id = result.data["id"]
        url = f"/api/orders/{order_id}/refund/"
        self.assertEqual(self.client.post(url).status_code, 200)
        self.assertEqual(self.client.post(url).status_code, 200)
        self.assertEqual(wallet_balance(self.user), Decimal("25.00"))
        self.assertFalse(LibraryItem.objects.exists())
        self.assertEqual(Order.objects.get(pk=order_id).items.count(), 1)
        self.assertEqual(WalletTransaction.objects.filter(kind="refund").count(), 1)

    def test_refund_cannot_access_other_user_or_expired_order(self):
        order_id = self.client.post("/api/orders/checkout/").data["id"]
        stranger = get_user_model().objects.create_user(username="other_refund", email="other_refund@example.test")
        self.client.force_authenticate(stranger)
        self.assertEqual(self.client.post(f"/api/orders/{order_id}/refund/").status_code, 404)
        self.client.force_authenticate(self.user)
        Order.objects.filter(pk=order_id).update(created_at=timezone.now() - timedelta(days=15))
        self.assertEqual(self.client.post(f"/api/orders/{order_id}/refund/").status_code, 400)

    def test_refund_does_not_orphan_separately_owned_dlc(self):
        order_id = self.client.post("/api/orders/checkout/").data["id"]
        dlc = DLC.objects.create(game=self.game, title="Expansion", price="5.00", description="More", release_date=date(2025, 2, 1))
        other = Order.objects.create(user=self.user, status="completed", total_price="5.00")
        LibraryDLCItem.objects.create(user=self.user, dlc=dlc, order=other, price_at_purchase="5.00")
        self.assertEqual(self.client.post(f"/api/orders/{order_id}/refund/").status_code, 400)
