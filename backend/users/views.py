from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Q
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .serializers import (
    CurrentUserProfileSerializer,
    LoginSerializer,
    ProfileSerializer,
    RegistrationSerializer,
)


User = get_user_model()


class RegisterView(generics.CreateAPIView):
    """Create an account and immediately issue an access/refresh token pair."""

    serializer_class = RegistrationSerializer
    authentication_classes = ()
    permission_classes = (AllowAny,)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = LoginSerializer.get_token(user)
        profile = ProfileSerializer(user, context={"request": request})

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


class RefreshView(TokenRefreshView):
    """Issue a new access token for a valid refresh token."""

    authentication_classes = ()
    permission_classes = (AllowAny,)


class CurrentUserProfileView(generics.RetrieveUpdateAPIView):
    """Return or partially update only the authenticated user's profile."""

    serializer_class = CurrentUserProfileSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "patch", "head", "options")

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return User.objects.none()

        return User.objects.filter(pk=self.request.user.pk).annotate(
            library_games_count=Count("library_items", distinct=True),
            favorite_games_count=Count(
                "library_items",
                filter=Q(library_items__is_favorite=True),
                distinct=True,
            ),
            wishlist_games_count=Count("game_wishlist_items", distinct=True),
            reviews_count=Count("game_reviews", distinct=True),
            posts_count=Count(
                "community_posts",
                filter=Q(community_posts__is_published=True),
                distinct=True,
            ),
            followers_count=Count("follower_links", distinct=True),
            following_count=Count("following_links", distinct=True),
        )

    def get_object(self):
        profile = self.get_queryset().get(pk=self.request.user.pk)
        self.check_object_permissions(self.request, profile)
        return profile
