from django.contrib.auth.models import AbstractUser
from django.core.validators import FileExtensionValidator
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone
from datetime import timedelta

from core.validators import validate_image_size


def default_notification_preferences():
    return dict.fromkeys(("store_sale", "wishlist_sale", "comment", "friend_request", "friend_accepted", "friend_rejected", "message", "message_sound", "reaction", "follow", "news"), True)


class User(AbstractUser):
    """Project user used by authentication, profiles, orders, and reviews."""

    email = models.EmailField(unique=True)
    bio = models.CharField(max_length=500, blank=True)
    cover = models.ImageField(upload_to="covers/%Y/%m/", blank=True, null=True, validators=[FileExtensionValidator(["jpg", "jpeg", "png", "webp"]), validate_image_size])
    language = models.CharField(
        max_length=5,
        choices=[("en", "English"), ("ru", "Русский"), ("uk", "Українська")],
        default="en",
    )
    dark_theme = models.BooleanField(default=True)
    privacy_games = models.BooleanField(default=True)
    privacy_wishlist = models.BooleanField(default=True)
    privacy_friends = models.BooleanField(default=True)
    privacy_activity = models.BooleanField(default=True)
    privacy_messages = models.CharField(max_length=10, choices=[("everyone", "Everyone"), ("friends", "Friends"), ("nobody", "Nobody")], default="everyone")
    show_online = models.BooleanField(default=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    notification_preferences = models.JSONField(default=default_notification_preferences)
    password_history = models.JSONField(default=list, editable=False)
    token_version = models.PositiveIntegerField(default=0, editable=False)
    avatar = models.ImageField(
        upload_to="avatars/%Y/%m/",
        blank=True,
        null=True,
        validators=[
            FileExtensionValidator(["jpg", "jpeg", "png", "webp"]),
            validate_image_size,
        ],
    )

    REQUIRED_FIELDS = ["email"]

    class Meta:
        ordering = ["username"]
        constraints = [
            models.UniqueConstraint(Lower("email"), name="unique_user_email_ci"),
            models.UniqueConstraint(
                Lower("username"),
                name="unique_user_username_ci",
            ),
        ]

    @property
    def created_at(self):
        """Expose Django's date_joined under the project API name."""

        return self.date_joined

    def __str__(self) -> str:
        return self.username

    @property
    def is_online(self):
        return bool(self.show_online and self.last_seen_at and self.last_seen_at >= timezone.now() - timedelta(minutes=5))


class UserBlock(models.Model):
    blocker = models.ForeignKey(User, on_delete=models.CASCADE, related_name="blocks_created")
    blocked = models.ForeignKey(User, on_delete=models.CASCADE, related_name="blocks_received")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("blocker", "blocked"), name="unique_user_block"), models.CheckConstraint(condition=~models.Q(blocker=models.F("blocked")), name="prevent_self_block")]


class UserBadge(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="badges")
    code = models.CharField(max_length=40)
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=240)
    icon = models.CharField(max_length=10, default="★")
    points = models.PositiveIntegerField()
    earned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-earned_at", "-id"]
        constraints = [models.UniqueConstraint(fields=("user", "code"), name="unique_user_badge")]


class ProfileComment(models.Model):
    profile = models.ForeignKey(User, on_delete=models.CASCADE, related_name="profile_comments")
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="authored_profile_comments")
    body = models.CharField(max_length=1200)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class WalletTransaction(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="wallet_transactions")
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    kind = models.CharField(max_length=20, choices=[("topup", "Demo top-up"), ("purchase", "Purchase"), ("refund", "Refund"), ("demo_payment", "Demo payment")])
    description = models.CharField(max_length=240)
    order = models.ForeignKey("store.Order", on_delete=models.SET_NULL, null=True, blank=True, related_name="wallet_transactions")
    event_key = models.CharField(max_length=160, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValueError("Wallet transactions are immutable.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("Wallet transactions are immutable.")


class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=30)
    title = models.CharField(max_length=160)
    body = models.CharField(max_length=300, blank=True)
    target_path = models.CharField(max_length=300)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at", "-pk")
        indexes = [models.Index(fields=("user", "read_at", "-created_at"), name="notification_unread_idx")]
