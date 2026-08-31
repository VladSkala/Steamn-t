from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import F, Q

from core.models import TimeStampedModel
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
    is_published = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-pk"]
        indexes = [
            models.Index(fields=["kind", "-created_at"], name="post_kind_created_idx"),
        ]

    def __str__(self) -> str:
        return self.title


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
