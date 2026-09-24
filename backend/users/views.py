from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .serializers import (
    CurrentUserProfileSerializer,
    LoginSerializer,
    RegistrationSerializer,
    VersionedTokenRefreshSerializer,
    with_profile_stats,
)
from community.models import CommunityPost, Friendship, UserFollow
from store.models import LibraryItem
from users.models import UserBlock
from users.models import WalletTransaction, Notification
from users.wallet_services import wallet_balance
from decimal import Decimal, InvalidOperation
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from uuid import uuid4


User = get_user_model()


class RegistrationThrottle(AnonRateThrottle):
    scope = "registration"
    rate = "10/hour"


class LoginThrottle(AnonRateThrottle):
    scope = "login"
    rate = "20/minute"


class RegisterView(generics.CreateAPIView):
    """Create an account and immediately issue an access/refresh token pair."""

    serializer_class = RegistrationSerializer
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (RegistrationThrottle,)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = LoginSerializer.get_token(user)
        profile_user = with_profile_stats(User.objects.filter(pk=user.pk)).get()
        profile = CurrentUserProfileSerializer(
            profile_user,
            context={"request": request},
        )

        return Response(
            {
                "user": profile.data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    """Issue access and refresh JWTs for a valid email/password pair."""

    serializer_class = LoginSerializer
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (LoginThrottle,)


class RefreshView(TokenRefreshView):
    """Issue a new access token for a valid refresh token."""

    authentication_classes = ()
    permission_classes = (AllowAny,)
    serializer_class = VersionedTokenRefreshSerializer


class CurrentUserProfileView(generics.RetrieveUpdateAPIView):
    """Return or partially update only the authenticated user's profile."""

    serializer_class = CurrentUserProfileSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "patch", "head", "options")

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return User.objects.none()

        return with_profile_stats(User.objects.filter(pk=self.request.user.pk))

    def get_object(self):
        profile = self.get_queryset().get(pk=self.request.user.pk)
        self.check_object_permissions(self.request, profile)
        return profile


class PublicProfileView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()

    def get(self, request, user_id):
        user = get_object_or_404(User, pk=user_id, is_active=True)
        payload = {
            "id": user.pk, "username": user.username, "display_name": user.get_full_name().strip() or user.username,
            "bio": user.bio, "avatar": user.avatar.url if user.avatar else None,
            "cover": user.cover.url if user.cover else None, "joined_at": user.date_joined,
            "is_online": user.is_online, "badges": list(user.badges.values("name", "description", "icon", "points")[:8]),
            "stats": {"games": user.library_items.count() if user.privacy_games else None,
                      "wishlist": user.game_wishlist_items.count() if user.privacy_wishlist else None,
                      "friends": Friendship.objects.filter(Q(user_low=user) | Q(user_high=user), status="accepted").count() if user.privacy_friends else None,
                      "followers": user.follower_links.count(), "following": user.following_links.count(),
                      "posts": user.community_posts.filter(is_published=True).count() if user.privacy_activity else None},
        }
        if user.privacy_games:
            payload["games"] = list(LibraryItem.objects.filter(user=user).filter(Q(order__isnull=True) | Q(order__user=user)).select_related("game").values("game_id", "game__title", "game__cover")[:24])
        if user.privacy_wishlist:
            payload["wishlist"] = list(user.game_wishlist_items.select_related("game").values("game_id", "game__title", "game__cover")[:24])
        if user.privacy_activity:
            payload["posts"] = list(CommunityPost.objects.filter(author=user, is_published=True).values("id", "title", "kind", "created_at")[:24])
        return Response(payload)


class PublicProfileSocialView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request, user_id):
        from chat.views import can_message
        other = get_object_or_404(User, pk=user_id, is_active=True)
        low, high = sorted((request.user.pk, other.pk))
        friendship = Friendship.objects.filter(user_low_id=low, user_high_id=high).first()
        return Response({"following": UserFollow.objects.filter(follower=request.user, following=other).exists(),
                         "friend_status": friendship.status if friendship else "none",
                         "relationship_id": friendship.pk if friendship else None,
                         "request_direction": ("outgoing" if friendship.requested_by_id == request.user.pk else "incoming") if friendship and friendship.status == "pending" else None,
                         "blocked": UserBlock.objects.filter(blocker=request.user, blocked=other).exists(),
                         "can_message": can_message(request.user, other)})

    def post(self, request, user_id):
        other = get_object_or_404(User, pk=user_id, is_active=True)
        if other.pk == request.user.pk:
            return Response({"detail": "You cannot follow yourself."}, status=400)
        if UserBlock.objects.filter(Q(blocker=request.user, blocked=other) | Q(blocker=other, blocked=request.user)).exists():
            return Response({"detail": "This profile is unavailable."}, status=403)
        UserFollow.objects.get_or_create(follower=request.user, following=other)
        return Response({"following": True})

    def delete(self, request, user_id):
        UserFollow.objects.filter(follower=request.user, following_id=user_id).delete()
        return Response({"following": False})


class PasswordChangeView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        current = request.data.get("current_password", "")
        new = request.data.get("new_password", "")
        if not request.user.check_password(current):
            return Response({"current_password": "Current password is incorrect."}, status=400)
        try:
            validate_password(new, user=request.user)
        except DjangoValidationError as error:
            return Response({"new_password": error.messages}, status=400)
        if current == new:
            return Response({"new_password": "Choose a different password."}, status=400)
        request.user.set_password(new)
        request.user.token_version += 1
        request.user.save(update_fields=("password", "token_version"))
        return Response({"detail": "Password changed. Sign in again with your new password."})


class WalletView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        paginator.page_size = 20
        rows = WalletTransaction.objects.filter(user=request.user).values("id", "amount", "kind", "description", "created_at", "order_id")
        transactions = paginator.paginate_queryset(rows, request)
        return Response({"balance": f"{wallet_balance(request.user):.2f}", "transactions": transactions, "count": paginator.page.paginator.count, "next": paginator.get_next_link(), "previous": paginator.get_previous_link()})

    @transaction.atomic
    def post(self, request):
        try:
            amount = Decimal(str(request.data.get("amount", "")))
        except (InvalidOperation, ValueError):
            return Response({"amount": "Enter a valid amount."}, status=400)
        if not amount.is_finite() or amount < Decimal("1.00") or amount > Decimal("500.00") or amount.as_tuple().exponent < -2:
            return Response({"amount": "Demo top-ups must be between 1.00 and 500.00."}, status=400)
        key = str(request.data.get("request_id") or uuid4().hex)
        if len(key) > 80 or not key.replace("-", "").isalnum():
            return Response({"detail": "Invalid request identifier."}, status=400)
        User.objects.select_for_update().get(pk=request.user.pk)
        entry, created = WalletTransaction.objects.get_or_create(event_key=f"topup:{request.user.pk}:{key}", defaults={"user": request.user, "amount": amount, "kind": "topup", "description": "Demo wallet top-up"})
        if not created and entry.amount != amount:
            return Response({"detail": "This request identifier has already been used for a different amount."}, status=409)
        return self.get(request)


class DeleteAccountView(APIView):
    permission_classes = (IsAuthenticated,)

    @transaction.atomic
    def post(self, request):
        user = get_object_or_404(User.objects.select_for_update(), pk=request.user.pk)
        if request.data.get("username", "").casefold() != user.username.casefold() or not user.check_password(request.data.get("password", "")):
            return Response({"detail": "Username or password is incorrect."}, status=400)
        if request.data.get("confirmation") != "DELETE":
            return Response({"detail": "Type DELETE to confirm."}, status=400)
        # Cascades remove this demo account's orders, library, social content and
        # conversations. File cleanup runs only after the database commit.
        user.delete()
        return Response({"detail": "Account and associated data deleted."})


class NotificationView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        paginator.page_size = 20
        queryset = Notification.objects.filter(user=request.user).values("id", "kind", "title", "body", "target_path", "created_at", "read_at")
        rows = paginator.paginate_queryset(queryset, request)
        unread = Notification.objects.filter(user=request.user, read_at__isnull=True).count()
        return Response({"items": rows, "unread_count": unread, "count": paginator.page.paginator.count, "next": paginator.get_next_link(), "previous": paginator.get_previous_link()})


class NotificationReadView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, notification_id):
        changed = Notification.objects.filter(pk=notification_id, user=request.user, read_at__isnull=True).update(read_at=timezone.now())
        if not Notification.objects.filter(pk=notification_id, user=request.user).exists():
            return Response({"detail": "Notification unavailable."}, status=404)
        return Response({"marked_read": bool(changed)})


class NotificationReadAllView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        count = Notification.objects.filter(user=request.user, read_at__isnull=True).update(read_at=timezone.now())
        return Response({"marked_read": count})
