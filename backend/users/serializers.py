from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.exceptions import InvalidToken


User = get_user_model()


class ProfileSerializer(serializers.ModelSerializer):
    """Read and update the fields exposed for the current user profile."""

    created_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "avatar",
            "created_at",
        )
        read_only_fields = ("id", "created_at")
        extra_kwargs = {
            "email": {"required": True},
            "first_name": {"required": False, "allow_blank": True},
            "last_name": {"required": False, "allow_blank": True},
            "avatar": {"required": False, "allow_null": True},
        }

    def validate_username(self, value):
        normalized_username = value.strip()
        queryset = User.objects.filter(username__iexact=normalized_username)
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return normalized_username

    def validate_email(self, value):
        normalized_email = value.strip().lower()
        queryset = User.objects.filter(email__iexact=normalized_email)
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return normalized_email

    def update(self, instance, validated_data):
        try:
            with transaction.atomic():
                return super().update(instance, validated_data)
        except IntegrityError as error:
            raise serializers.ValidationError(
                {"detail": "That email or username is already in use."}
            ) from error


class CurrentUserProfileSerializer(ProfileSerializer):
    """Profile-page contract with read-only data for the Figma summary cards."""

    display_name = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()

    class Meta(ProfileSerializer.Meta):
        fields = (
            "id",
            "username",
            "display_name",
            "email",
            "first_name",
            "last_name",
            "avatar",
            "cover",
            "bio",
            "language",
            "dark_theme",
            "privacy_games",
            "privacy_wishlist",
            "privacy_friends",
            "privacy_activity",
            "privacy_messages",
            "show_online",
            "notification_preferences",
            "created_at",
            "stats",
        )
        read_only_fields = ProfileSerializer.Meta.read_only_fields + (
            "display_name",
            "stats",
        )

    def validate_notification_preferences(self, value):
        from users.models import default_notification_preferences
        allowed = set(default_notification_preferences())
        if not isinstance(value, dict) or set(value) != allowed or any(type(item) is not bool for item in value.values()):
            raise serializers.ValidationError("Provide a boolean value for every notification preference.")
        return value

    def get_display_name(self, user):
        return user.get_full_name().strip() or user.username

    def get_stats(self, user):
        return {
            "library_games": user.library_games_count,
            "favorite_games": user.favorite_games_count,
            "wishlist_games": user.wishlist_games_count,
            "reviews": user.reviews_count,
            "posts": user.posts_count,
            "friends": user.friends_count,
            "followers": user.followers_count,
            "following": user.following_count,
        }


class RegistrationSerializer(serializers.ModelSerializer):
    """Validate and create a new project user without exposing passwords."""

    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    class Meta:
        model = User
        fields = (
            "username",
            "email",
            "first_name",
            "last_name",
            "password",
            "password_confirm",
        )
        extra_kwargs = {
            "email": {"required": True},
            "first_name": {"required": False, "allow_blank": True},
            "last_name": {"required": False, "allow_blank": True},
        }

    def validate_username(self, value):
        normalized_username = value.strip()
        if User.objects.filter(username__iexact=normalized_username).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return normalized_username

    def validate_email(self, value):
        normalized_email = value.strip().lower()
        if User.objects.filter(email__iexact=normalized_email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return normalized_email

    def validate(self, attrs):
        password = attrs.get("password")
        password_confirm = attrs.pop("password_confirm", None)

        if password != password_confirm:
            raise serializers.ValidationError(
                {"password_confirm": "Passwords do not match."}
            )

        candidate_user = User(
            username=attrs.get("username", ""),
            email=attrs.get("email", ""),
            first_name=attrs.get("first_name", ""),
            last_name=attrs.get("last_name", ""),
        )

        try:
            validate_password(password, user=candidate_user)
        except DjangoValidationError as error:
            raise serializers.ValidationError({"password": error.messages}) from error

        return attrs

    def create(self, validated_data):
        try:
            with transaction.atomic():
                return User.objects.create_user(**validated_data)
        except IntegrityError as error:
            raise serializers.ValidationError(
                {"detail": "That email or username is already in use."}
            ) from error


class LoginSerializer(TokenObtainPairSerializer):
    """Issue JWTs for an email/password pair and return the current user."""

    username_field = "email"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["email"] = serializers.EmailField(write_only=True)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["email"] = user.email
        token["token_version"] = user.token_version
        return token

    def validate(self, attrs):
        attrs["email"] = attrs["email"].strip().lower()
        data = super().validate(attrs)
        data["user"] = ProfileSerializer(self.user, context=self.context).data
        return data


class VersionedTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        refresh = self.token_class(attrs["refresh"])
        try:
            user = User.objects.get(pk=refresh["user_id"], is_active=True)
        except User.DoesNotExist as error:
            raise InvalidToken("Session expired.") from error
        if refresh.get("token_version") != user.token_version:
            raise InvalidToken("Session expired.")
        return super().validate(attrs)
