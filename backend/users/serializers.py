from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


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
        queryset = User.objects.filter(username__iexact=value)
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate_email(self, value):
        normalized_email = value.strip().lower()
        queryset = User.objects.filter(email__iexact=normalized_email)
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return normalized_email


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
            "created_at",
            "stats",
        )
        read_only_fields = ProfileSerializer.Meta.read_only_fields + (
            "display_name",
            "stats",
        )

    def get_display_name(self, user):
        return user.get_full_name().strip() or user.username

    def get_stats(self, user):
        return {
            "library_games": user.library_games_count,
            "favorite_games": user.favorite_games_count,
            "wishlist_games": user.wishlist_games_count,
            "reviews": user.reviews_count,
            "posts": user.posts_count,
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
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

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
        return User.objects.create_user(**validated_data)


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
        return token

    def validate(self, attrs):
        attrs["email"] = attrs["email"].strip().lower()
        data = super().validate(attrs)
        data["user"] = ProfileSerializer(self.user, context=self.context).data
        return data
