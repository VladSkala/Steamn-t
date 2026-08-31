from rest_framework import serializers

from community.models import CommunityPost, GameReview, PostComment
from games.models import Game
from games.serializers import GenreSerializer
from store.models import LibraryItem


class UserSummarySerializer(serializers.Serializer):
    """Small public user identity used in social library surfaces."""

    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(read_only=True)
    avatar = serializers.SerializerMethodField()

    def get_avatar(self, user) -> str | None:
        if not user.avatar:
            return None
        url = user.avatar.url
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url


class PostGameSerializer(serializers.ModelSerializer):
    cover = serializers.SerializerMethodField()

    class Meta:
        model = Game
        fields = ("id", "title", "cover")
        read_only_fields = fields

    def get_cover(self, game: Game) -> str | None:
        if not game.cover:
            return None
        url = game.cover.url
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url


class OwnedGameSerializer(PostGameSerializer):
    """Private game metadata exposed only to confirmed owners."""

    genres = GenreSerializer(many=True, read_only=True)

    class Meta:
        model = Game
        fields = (
            "id",
            "title",
            "description",
            "price",
            "cover",
            "hero_image_url",
            "download_url",
            "disk_size_gb",
            "developer",
            "release_date",
            "requirements",
            "genres",
        )
        read_only_fields = fields


class OwnedLibraryItemSerializer(serializers.ModelSerializer):
    """Expanded library row used by the KAN-23 experience endpoints."""

    game = OwnedGameSerializer(read_only=True)
    price_at_purchase = serializers.DecimalField(
        source="annotated_price_at_purchase",
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )
    purchased_at = serializers.DateTimeField(read_only=True)
    collection_ids = serializers.SerializerMethodField()

    class Meta:
        model = LibraryItem
        fields = (
            "id",
            "game",
            "price_at_purchase",
            "purchased_at",
            "is_favorite",
            "collection_ids",
        )
        read_only_fields = fields

    def get_collection_ids(self, item: LibraryItem) -> list[int]:
        return [
            collection.pk
            for collection in item.game.library_collections.all()
            if collection.user_id == item.user_id
        ]


class CommunityPostSerializer(serializers.ModelSerializer):
    author = UserSummarySerializer(read_only=True)
    game = PostGameSerializer(read_only=True)
    media = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = CommunityPost
        fields = (
            "id",
            "kind",
            "title",
            "body",
            "media",
            "author",
            "game",
            "like_count",
            "comment_count",
            "is_liked",
            "created_at",
        )
        read_only_fields = fields

    def get_media(self, post: CommunityPost) -> str | None:
        if post.media_url:
            return post.media_url
        if post.game and post.game.cover:
            url = post.game.cover.url
            request = self.context.get("request")
            return request.build_absolute_uri(url) if request else url
        return None

    def get_like_count(self, post: CommunityPost) -> int:
        value = getattr(post, "like_count", None)
        return value if value is not None else post.reactions.count()

    def get_comment_count(self, post: CommunityPost) -> int:
        value = getattr(post, "comment_count", None)
        return value if value is not None else post.comments.count()

    def get_is_liked(self, post: CommunityPost) -> bool:
        return bool(getattr(post, "viewer_has_liked", False))


class PostCommentSerializer(serializers.ModelSerializer):
    author = UserSummarySerializer(read_only=True)

    class Meta:
        model = PostComment
        fields = ("id", "author", "body", "created_at")
        read_only_fields = ("id", "author", "created_at")

    def validate_body(self, value: str) -> str:
        body = value.strip()
        if not body:
            raise serializers.ValidationError("Comment cannot be empty.")
        return body


class GameReviewSerializer(serializers.ModelSerializer):
    author = UserSummarySerializer(source="user", read_only=True)

    class Meta:
        model = GameReview
        fields = ("id", "author", "rating", "body", "created_at", "updated_at")
        read_only_fields = ("id", "author", "created_at", "updated_at")

    def validate_body(self, value: str) -> str:
        body = value.strip()
        if not body:
            raise serializers.ValidationError("Review cannot be empty.")
        return body
