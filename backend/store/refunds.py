from datetime import timedelta
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from users.wallet_services import refund_purchase
from .models import Order, LibraryItem, LibraryDLCItem


class OrderRefundView(APIView):
    permission_classes = (IsAuthenticated,)

    @transaction.atomic
    def post(self, request, order_id):
        # Match checkout's lock ordering to serialize all wallet/ownership changes.
        type(request.user).objects.select_for_update().get(pk=request.user.pk)
        order = get_object_or_404(Order.objects.select_for_update(), pk=order_id, user=request.user)
        if order.status == Order.Status.REFUNDED:
            return Response({"status": "refunded"})
        if order.status != Order.Status.COMPLETED or order.created_at < timezone.now() - timedelta(days=14):
            return Response({"detail": "Only completed orders from the last 14 days can be refunded."}, status=400)
        games = LibraryItem.objects.filter(user=request.user, order=order)
        if LibraryDLCItem.objects.filter(user=request.user, dlc__game_id__in=games.values("game_id")).exclude(order=order).exists():
            return Response({"detail": "Refund separately purchased DLC before refunding its base game."}, status=400)
        refund_purchase(request.user, order)
        LibraryDLCItem.objects.filter(user=request.user, order=order).delete()
        games.delete()
        order.status = Order.Status.REFUNDED
        order.save(update_fields=("status", "updated_at"))
        return Response({"status": "refunded"})
