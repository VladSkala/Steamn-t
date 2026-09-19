from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from datetime import timedelta
from django.utils import timezone


class VersionedJWTAuthentication(JWTAuthentication):
    """Reject tokens issued before a password or account-security change."""

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if validated_token.get("token_version") != user.token_version:
            raise AuthenticationFailed("Session expired.", code="token_not_valid")
        now = timezone.now()
        if not user.last_seen_at or user.last_seen_at < now - timedelta(minutes=1):
            type(user).objects.filter(pk=user.pk).update(last_seen_at=now)
            user.last_seen_at = now
        return user
