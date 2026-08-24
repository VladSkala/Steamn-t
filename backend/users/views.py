from django.db import transaction
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .serializers import LoginSerializer, ProfileSerializer, RegistrationSerializer


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
    """Return or partially update the authenticated user's profile."""

    serializer_class = ProfileSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "patch", "head", "options")

    def get_object(self):
        return self.request.user
