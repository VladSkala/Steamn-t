from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Q
from rest_framework import serializers
from PIL import Image, UnidentifiedImageError

from community.models import (
    CommunityPost,
    Friendship,
    GameReview,
    GameReviewImage,
    GameWishlist,
    PostComment,
)
from games.models import Game
from games.serializers import GameListSerializer, GenreSerializer
from store.models import LibraryItem


User = get_user_model()

DUPLICATE_WISHLIST_MESSAGE = "This game is already in your wishlist."
OWNED_WISHLIST_MESSAGE = "This game is already in your library."


class UserSummarySerializer(serializers.Serializer):
    """Small public identity that never exposes email or account flags."""

    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(read_only=True)
    display_name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    is_online = serializers.BooleanField(read_only=True)

    def get_display_name(self, user) -> str:
        return user.get_full_name().strip() or user.username

    def get_avatar(self, user) -> str | None:
        if not user.avatar:
            return None
        url = user.avatar.url
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url


class FriendshipSerializer(serializers.Serializer):
    """Viewer-relative representation of one canonical relationship row."""

    id = serializers.IntegerField(read_only=True)
    user = serializers.SerializerMethodField()
    relationship_status = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def get_user(self, relationship: Friendship):
        viewer = self.context["viewer"]
        return UserSummarySerializer(
            relationship.other_user(viewer),
            context=self.context,
        ).data

    def get_relationship_status(self, relationship: Friendship) -> str:
        if relationship.status == Friendship.Status.ACCEPTED:
            return "friend"
        viewer = self.context["viewer"]
        return "outgoing" if relationship.requested_by_id == viewer.pk else "incoming"


class FriendSearchResultSerializer(UserSummarySerializer):
    relationship_status = serializers.SerializerMethodField()
    request_id = serializers.SerializerMethodField()

    def _relationship(self, user):
        return self.context.get("relationship_map", {}).get(user.pk)

    def get_relationship_status(self, user) -> str:
        relationship = self._relationship(user)
        if not relationship:
            return "none"
        if relationship.status == Friendship.Status.ACCEPTED:
            return "friend"
        viewer = self.context["viewer"]
        return "outgoing" if relationship.requested_by_id == viewer.pk else "incoming"

    def get_request_id(self, user) -> int | None:
        relationship = self._relationship(user)
        return relationship.pk if relationship else None


class FriendRequestCreateSerializer(serializers.Serializer):
    user_id = serializers.PrimaryKeyRelatedField(
        source="recipient",
        queryset=User.objects.filter(is_active=True),
    )


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


class WishlistItemSerializer(serializers.ModelSerializer):
    """One game saved in the authenticated user's personal wishlist."""

    game = GameListSerializer(read_only=True)

    class Meta:
        model = GameWishlist
        fields = ("id", "game", "created_at")
        read_only_fields = fields


class WishlistItemCreateSerializer(serializers.ModelSerializer):
    """Validate and create a personal wishlist item without duplicates."""

    game_id = serializers.PrimaryKeyRelatedField(
        queryset=Game.objects.all(),
        source="game",
        write_only=True,
    )

    class Meta:
        model = GameWishlist
        fields = ("game_id",)

    def validate_game_id(self, game: Game) -> Game:
        user = self.context["request"].user
        if LibraryItem.objects.filter(
            user=user,
            game=game,
        ).filter(Q(order__isnull=True) | Q(order__user=user)).exists():
            raise serializers.ValidationError(OWNED_WISHLIST_MESSAGE)
        if GameWishlist.objects.filter(user=user, game=game).exists():
            raise serializers.ValidationError(DUPLICATE_WISHLIST_MESSAGE)
        return game

    def create(self, validated_data):
        try:
            with transaction.atomic():
                return GameWishlist.objects.create(
                    user=self.context["request"].user,
                    **validated_data,
                )
        except IntegrityError as error:
            raise serializers.ValidationError(
                {"game_id": [DUPLICATE_WISHLIST_MESSAGE]},
            ) from error


class OwnedLibraryItemSerializer(serializers.ModelSerializer):
    """Expanded library row used by the KAN-23 experience endpoints."""

    game = OwnedGameSerializer(read_only=True)
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
    is_owner = serializers.SerializerMethodField()

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
            "is_owner",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_media(self, post: CommunityPost) -> str | None:
        if post.media_file:
            url = post.media_file.url
            request = self.context.get("request")
            return request.build_absolute_uri(url) if request else url
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

    def get_is_owner(self, post: CommunityPost) -> bool:
        request = self.context.get("request")
        return bool(
            request
            and request.user.is_authenticated
            and request.user.pk == post.author_id
        )


class CommunityPostWriteSerializer(serializers.ModelSerializer):
    """Create or edit a post without accepting forged author/publication data."""

    game_id = serializers.PrimaryKeyRelatedField(
        source="game",
        queryset=Game.objects.all(),
        required=False,
        allow_null=True,
    )
    body = serializers.CharField(max_length=5000, trim_whitespace=True, required=False, allow_blank=True)
    media_file = serializers.FileField(required=False, allow_null=True)

    class Meta:
        model = CommunityPost
        fields = ("kind", "title", "body", "game_id", "media_file")
        extra_kwargs = {
            "title": {"trim_whitespace": True},
            "kind": {"required": True},
        }

    def validate_kind(self, value: str) -> str:
        user_kinds = {
            CommunityPost.Kind.COMMUNITY,
            CommunityPost.Kind.FORUM,
            CommunityPost.Kind.GUIDE,
            CommunityPost.Kind.SCREENSHOT,
            CommunityPost.Kind.VIDEO,
        }
        if value not in user_kinds:
            raise serializers.ValidationError(
                "Choose Discussion, Forum, Guide, Screenshot, or Video."
            )
        return value

    def validate_title(self, value: str) -> str:
        title = value.strip()
        if not title:
            raise serializers.ValidationError("Post title cannot be empty.")
        return title

    def validate_body(self, value: str) -> str:
        body = value.strip()
        kind = self.initial_data.get("kind") or getattr(self.instance, "kind", None)
        if not body and kind not in (CommunityPost.Kind.SCREENSHOT, CommunityPost.Kind.VIDEO):
            raise serializers.ValidationError("Post body cannot be empty.")
        return body

    def validate_media_file(self, file):
        if file is None:
            return file
        kind = self.initial_data.get("kind") or getattr(self.instance, "kind", None)
        suffix = file.name.rsplit(".", 1)[-1].lower()
        if kind == CommunityPost.Kind.SCREENSHOT:
            if suffix not in {"jpg", "jpeg", "png", "webp"} or file.size > 5 * 1024 * 1024:
                raise serializers.ValidationError("Upload a JPG, PNG, or WEBP image up to 5 MB.")
            try:
                Image.open(file).verify()
            except (UnidentifiedImageError, OSError) as error:
                raise serializers.ValidationError("The image file is invalid.") from error
            finally:
                file.seek(0)
        elif kind == CommunityPost.Kind.VIDEO:
            if suffix not in {"mp4", "webm"} or file.size > 50 * 1024 * 1024:
                raise serializers.ValidationError("Upload an MP4 or WEBM video up to 50 MB.")
            header = file.read(16)
            file.seek(0)
            if not (header[4:8] == b"ftyp" or header[:4] == b"\x1a\x45\xdf\xa3"):
                raise serializers.ValidationError("The video file is invalid.")
        else:
            raise serializers.ValidationError("Media is available only for screenshots and videos.")
        return file

    def validate(self, attrs):
        kind = attrs.get("kind", getattr(self.instance, "kind", None))
        body = attrs.get("body", getattr(self.instance, "body", ""))
        if kind not in (CommunityPost.Kind.SCREENSHOT, CommunityPost.Kind.VIDEO) and not body.strip():
            raise serializers.ValidationError({"body": "Post body cannot be empty."})
        media = attrs.get("media_file", getattr(self.instance, "media_file", None))
        if kind in (CommunityPost.Kind.SCREENSHOT, CommunityPost.Kind.VIDEO) and not media:
            raise serializers.ValidationError({"media_file": "Media is required for this post type."})
        if kind in (CommunityPost.Kind.SCREENSHOT, CommunityPost.Kind.VIDEO) and not attrs.get("game", getattr(self.instance, "game", None)):
            raise serializers.ValidationError({"game_id": "Choose an owned game for media posts."})
        return attrs

    def validate_game_id(self, game: Game | None) -> Game | None:
        if game is None:
            return None
        user = self.context["request"].user
        if not LibraryItem.objects.filter(
            user=user,
            game=game,
        ).filter(Q(order__isnull=True) | Q(order__user=user)).exists():
            raise serializers.ValidationError(
                "You can associate posts only with games in your library."
            )
        return game


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


class GameReviewImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = GameReviewImage
        fields = ("id", "image", "position")
        read_only_fields = ("id", "position")


class GameReviewSerializer(serializers.ModelSerializer):
    game_id = serializers.IntegerField(read_only=True)
    author = UserSummarySerializer(source="user", read_only=True)
    images = GameReviewImageSerializer(many=True, read_only=True)
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = GameReview
        fields = (
            "id",
            "game_id",
            "author",
            "rating",
            "body",
            "images",
            "is_owner",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "game_id",
            "author",
            "images",
            "is_owner",
            "created_at",
            "updated_at",
        )
        extra_kwargs = {
            "rating": {"required": True},
            "body": {"required": True},
        }

    def get_is_owner(self, review: GameReview) -> bool:
        request = self.context.get("request")
        return bool(
            request
            and request.user.is_authenticated
            and request.user.pk == review.user_id
        )

    def validate_body(self, value: str) -> str:
        body = value.strip()
        if not body:
            raise serializers.ValidationError("Review cannot be empty.")
        return body


class MyReviewGameSerializer(serializers.ModelSerializer):
    """Compact game identity needed by the future My Reviews page."""

    cover = serializers.SerializerMethodField()

    class Meta:
        model = Game
        fields = ("id", "title", "cover", "developer")
        read_only_fields = fields

    def get_cover(self, game: Game) -> str | None:
        if not game.cover:
            return None
        url = game.cover.url
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url


class MyReviewSerializer(serializers.ModelSerializer):
    """Private review row returned only to its authenticated author."""

    game = MyReviewGameSerializer(read_only=True)
    images = GameReviewImageSerializer(many=True, read_only=True)

    class Meta:
        model = GameReview
        fields = (
            "id",
            "game",
            "rating",
            "body",
            "images",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields
