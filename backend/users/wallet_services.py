"""Append-only demo money journal; every purchase is recorded atomically."""
from decimal import Decimal
from django.db import transaction
from django.db.models import Sum
from rest_framework.exceptions import ValidationError
from .models import User, WalletTransaction


def wallet_balance(user):
    return WalletTransaction.objects.filter(user=user).aggregate(value=Sum("amount"))["value"] or Decimal("0.00")


@transaction.atomic
def record_purchase(user, order, payment_method="demo"):
    User.objects.select_for_update().get(pk=user.pk)
    if WalletTransaction.objects.filter(event_key=f"purchase:{order.pk}").exists():
        return
    if payment_method not in {"demo", "wallet"}:
        raise ValidationError({"payment_method": "Choose demo or wallet payment."})
    if payment_method == "wallet" and wallet_balance(user) < order.total_price:
        raise ValidationError({"detail": "Your demo wallet has insufficient funds."})
    if payment_method == "demo":
        WalletTransaction.objects.create(user=user, order=order, amount=order.total_price, kind="demo_payment", description=f"Simulated payment for order #{order.pk}", event_key=f"demo-payment:{order.pk}")
    WalletTransaction.objects.create(user=user, order=order, amount=-order.total_price, kind="purchase", description=f"Order #{order.pk}", event_key=f"purchase:{order.pk}")


@transaction.atomic
def refund_purchase(user, order):
    User.objects.select_for_update().get(pk=user.pk)
    WalletTransaction.objects.get_or_create(event_key=f"refund:{order.pk}", defaults={"user": user, "order": order, "amount": order.total_price, "kind": "refund", "description": f"Refund for order #{order.pk}"})
