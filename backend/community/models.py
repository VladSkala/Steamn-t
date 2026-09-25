from django.conf import settings
from django.core.validators import FileExtensionValidator, MaxValueValidator, MinValueValidator
from django.db import models, transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.db.models import F, Q

from core.models import TimeStampedModel
from core.validators import validate_image_size
from games.models import Game


class CommunityPost(TimeStampedModel):
    """A published library news or community-feed entry."""

    class Kind(models.TextChoices):
        NEWS = "news", "News"
        COMMUNITY = "community", "Community"
        FORUM = "forum", "Forum"
        SCREENSHOT = "screenshot", "Screenshot"
        VIDEO = "video", "Video"
        GUIDE = "guide", "Guide"

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="community_posts",
    )
    game = models.ForeignKey(
        Game,
        on_delete=models.CASCADE,
        related_name="community_posts",
        blank=True,
        null=True,
    )
    kind = models.CharField(
        max_length=20,
        choices=Kind.choices,
        default=Kind.COMMUNITY,
        db_index=True,
    )
    title = models.CharField(max_length=240)
    body = models.TextField(blank=True)
    media_url = models.CharField(max_length=500, blank=True)
    media_file = models.FileField(upload_to="community/%Y/%m/", blank=True, null=True)
    is_published = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-pk"]
        indexes = [
            models.Index(fields=["kind", "-created_at"], name="post_kind_created_idx"),
        ]

    def __str__(self) -> str:
        return self.title


@receiver(post_delete, sender=CommunityPost)
def delete_post_media_file(sender, instance, **kwargs):
    if instance.media_file:
        storage, name = instance.media_file.storage, instance.media_file.name
        transaction.on_commit(lambda: storage.delete(name))


class PostReaction(TimeStampedModel):
    """One like made by a user on one community post."""

    post = models.ForeignKey(
        CommunityPost,
        on_delete=models.CASCADE,
        related_name="reactions",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="post_reactions",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["post", "user"],
                name="unique_post_reaction",
            ),
        ]


class PostComment(TimeStampedModel):
    """A user-authored comment attached to a community post."""

    post = models.ForeignKey(
        CommunityPost,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="post_comments",
    )
    body = models.TextField(max_length=1200)

    class Meta:
        ordering = ["created_at", "pk"]


class GameReview(TimeStampedModel):
    """One review of an owned game, editable by its author."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="game_reviews",
    )
    game = models.ForeignKey(
        Game,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    rating = models.PositiveSmallIntegerField(
        default=5,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    body = models.TextField(max_length=4000)

    class Meta:
        ordering = ["-updated_at", "-pk"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "game"],
                name="unique_game_review_per_user",
            ),
            models.CheckConstraint(
                condition=Q(rating__gte=1, rating__lte=5),
                name="review_rating_between_1_and_5",
            ),
        ]
        indexes = [
            models.Index(
                fields=["game", "-updated_at", "-id"],
                name="review_game_updated_idx",
            ),
            models.Index(
                fields=["user", "-updated_at", "-id"],
                name="review_user_updated_idx",
            ),
        ]


class UserFollow(TimeStampedModel):
    """A directional social connection used by the library feed."""

    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="following_links",
    )
    following = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="follower_links",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["follower", "following"],
                name="unique_user_follow",
            ),
            models.CheckConstraint(
                condition=~Q(follower=F("following")),
                name="prevent_self_follow",
            ),
        ]


class Friendship(TimeStampedModel):
    """One canonical row for a pending request or an accepted friendship."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"

    user_low = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="friendships_as_low",
    )
    user_high = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="friendships_as_high",
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="friend_requests_started",
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    responded_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-updated_at", "-pk"]
        constraints = [
            models.UniqueConstraint(
                fields=["user_low", "user_high"],
                name="unique_friendship_pair",
            ),
            models.CheckConstraint(
                condition=Q(user_low__lt=F("user_high")),
                name="friendship_pair_is_ordered",
            ),
            models.CheckConstraint(
                condition=Q(requested_by=F("user_low"))
                | Q(requested_by=F("user_high")),
                name="friendship_requester_is_participant",
            ),
        ]
        indexes = [
            models.Index(
                fields=["status", "-updated_at", "-id"],
                name="friend_status_updated_idx",
            ),
        ]

    def includes(self, user) -> bool:
        return user.pk in (self.user_low_id, self.user_high_id)

    def other_user(self, user):
        if user.pk == self.user_low_id:
            return self.user_high
        if user.pk == self.user_high_id:
            return self.user_low
        raise ValueError("User is not part of this friendship.")


class GameReviewImage(TimeStampedModel):
    review = models.ForeignKey(GameReview, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(
        upload_to="reviews/%Y/%m/",
        validators=[
            FileExtensionValidator(allowed_extensions=("jpg", "jpeg", "png", "webp")),
            validate_image_size,
        ],
    )
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ("position", "created_at", "pk")
        indexes = [
            models.Index(fields=("review", "position"), name="review_image_position_idx")
        ]

    def __str__(self):
        return f"Review image {self.pk} for review {self.review_id}"


@receiver(post_delete, sender=GameReviewImage)
def delete_review_image_file(sender, instance, **kwargs):
    if instance.image:
        storage = instance.image.storage
        name = instance.image.name
        transaction.on_commit(lambda: storage.delete(name))


class GameWishlist(TimeStampedModel):
    """A real user-to-game wishlist link used by owned-game social context."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="game_wishlist_items",
    )
    game = models.ForeignKey(
        Game,
        on_delete=models.CASCADE,
        related_name="wishlist_items",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "game"],
                name="unique_game_wishlist_item",
            ),
        ]
