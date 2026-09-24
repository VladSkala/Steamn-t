from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q

from .models import User, UserBlock
from .social_services import block_user, public_identity


class RecoveryThrottle(AnonRateThrottle):
    scope = "password_recovery"
    rate = "5/hour"


class PasswordResetRequestView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()
    throttle_classes = (RecoveryThrottle,)

    def post(self, request):
        email = str(request.data.get("email", "")).strip()
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user and user.has_usable_password():
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            url = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"
            send_mail("Reset your Steamn’t password", f"Open this link to choose a new password:\n{url}\n\nIf you did not request this, ignore this message.", settings.DEFAULT_FROM_EMAIL, [user.email])
        return Response({"detail": "If this address belongs to an active account, a reset link has been sent."})


class PasswordResetConfirmView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()
    throttle_classes = (RecoveryThrottle,)

    @transaction.atomic
    def post(self, request):
        try:
            user_id = urlsafe_base64_decode(request.data.get("uid", "")).decode()
            user = User.objects.select_for_update().get(pk=user_id, is_active=True)
        except (ValueError, TypeError, UnicodeDecodeError, OverflowError, User.DoesNotExist):
            return Response({"detail": "This reset link is invalid or expired."}, status=400)
        if not default_token_generator.check_token(user, request.data.get("token", "")):
            return Response({"detail": "This reset link is invalid or expired."}, status=400)
        password = request.data.get("password", "")
        try:
            validate_password(password, user)
        except ValidationError as error:
            return Response({"detail": " ".join(error.messages)}, status=400)
        user.set_password(password)
        user.token_version += 1
        user.save(update_fields=("password", "token_version"))
        return Response({"detail": "Password reset. Sign in with your new password."})


class BlockListView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        rows = UserBlock.objects.filter(blocker=request.user).select_related("blocked")
        return Response({"items": [public_identity(row.blocked, request) for row in rows]})


class BlockView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, user_id):
        other = get_object_or_404(User, pk=user_id, is_active=True)
        block_user(blocker=request.user, blocked=other)
        return Response({"blocked": True})

    def delete(self, request, user_id):
        UserBlock.objects.filter(blocker=request.user, blocked_id=user_id).delete()
        return Response({"blocked": False})


class PublicProfileContentView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()

    def get(self, request, user_id):
        from community.models import CommunityPost, Friendship, GameReview, UserFollow
        user = get_object_or_404(User, pk=user_id, is_active=True)
        section = request.query_params.get("section", "games")
        privacy_key = {"games": "privacy_games", "wishlist": "privacy_wishlist", "friends": "privacy_friends"}.get(section)
        if privacy_key is None and section not in {"followers", "following"}:
            privacy_key = "privacy_activity"
        if privacy_key and not getattr(user, privacy_key):
            return Response({"detail": "This section is private."}, status=403)
        if section == "games":
            queryset = user.library_items.filter(Q(order__isnull=True) | Q(order__user=user)).select_related("game").order_by("-created_at", "-pk")
        elif section == "wishlist":
            queryset = user.game_wishlist_items.select_related("game").order_by("-created_at", "-pk")
        elif section == "reviews":
            queryset = GameReview.objects.filter(user=user).select_related("game").prefetch_related("images").order_by("-created_at", "-pk")
        elif section == "friends":
            queryset = Friendship.objects.filter(Q(user_low=user) | Q(user_high=user), status="accepted").select_related("user_low", "user_high").order_by("-pk")
        elif section == "followers":
            queryset = UserFollow.objects.filter(following=user).select_related("follower").order_by("-created_at", "-pk")
        elif section == "following":
            queryset = UserFollow.objects.filter(follower=user).select_related("following").order_by("-created_at", "-pk")
        else:
            kinds = {"discussions": "forum", "screenshots": "screenshot", "videos": "video", "guides": "guide", "news": "news"}
            if section not in {"activity", *kinds}:
                return Response({"detail": "Unknown profile section."}, status=400)
            queryset = CommunityPost.objects.filter(author=user, is_published=True).select_related("game").order_by("-created_at", "-pk")
            if section in kinds:
                queryset = queryset.filter(kind=kinds[section])
        search = request.query_params.get("search", "").strip()[:200]
        if search:
            if section in {"games", "wishlist", "reviews"}:
                queryset = queryset.filter(game__title__icontains=search)
            elif section == "friends":
                queryset = queryset.filter(Q(user_low=user, user_high__username__icontains=search) | Q(user_high=user, user_low__username__icontains=search))
            elif section == "followers":
                queryset = queryset.filter(Q(follower__username__icontains=search) | Q(follower__first_name__icontains=search) | Q(follower__last_name__icontains=search))
            elif section == "following":
                queryset = queryset.filter(Q(following__username__icontains=search) | Q(following__first_name__icontains=search) | Q(following__last_name__icontains=search))
            else:
                queryset = queryset.filter(Q(title__icontains=search) | Q(body__icontains=search))
        ordering = request.query_params.get("ordering", "latest")
        if ordering == "oldest":
            queryset = queryset.reverse()
        elif ordering == "title":
            field = "game__title" if section in {"games", "wishlist", "reviews"} else ("follower__username" if section == "followers" else "following__username" if section == "following" else "pk" if section == "friends" else "title")
            queryset = queryset.order_by(field, "pk")
        paginator = PageNumberPagination()
        paginator.page_size = 12
        page = paginator.paginate_queryset(queryset, request)
        rows = []
        for item in page:
            if section in {"games", "wishlist", "reviews"}:
                row = {"id": item.pk, "title": item.game.title, "url": f"/games/{item.game_id}", "image": item.game.cover.url if item.game.cover else None}
                if section == "reviews":
                    row.update(body=item.body, meta=f"{item.rating}/5", images=[{"id": image.pk, "image": image.image.url} for image in item.images.all()])
            elif section == "friends":
                other = item.other_user(user)
                row = {"id": other.pk, "title": other.username, "url": f"/users/{other.pk}", "image": other.avatar.url if other.avatar else None, "meta": "Online" if other.is_online else "Offline"}
            elif section in {"followers", "following"}:
                other = item.follower if section == "followers" else item.following
                row = {"id": other.pk, "title": other.username, "url": f"/users/{other.pk}", "image": other.avatar.url if other.avatar else None, "meta": "Online" if other.is_online else "Offline"}
            else:
                row = {"id": item.pk, "title": item.title, "url": f"/community/posts/{item.pk}", "body": item.body[:240], "meta": item.kind, "image": item.media_file.url if item.media_file and item.kind == "screenshot" else None}
            rows.append(row)
        return paginator.get_paginated_response(rows)
