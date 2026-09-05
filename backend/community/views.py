from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Exists, OuterRef, Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from community.models import (
    CommunityPost,
    GameReview,
    GameWishlist,
    PostComment,
    PostReaction,
    UserFollow,
)
from community.serializers import (
    CommunityPostSerializer,
    GameReviewImageSerializer,
    GameReviewSerializer,
    OwnedGameSerializer,
    OwnedLibraryItemSerializer,
    PostCommentSerializer,
    UserSummarySerializer,
    WishlistItemCreateSerializer,
    WishlistItemSerializer,
)
from store.models import LibraryCollection, LibraryItem, Order
from store.serializers import LibraryCollectionSerializer
from store.views import get_library_queryset


User = get_user_model()


def get_posts_queryset(user):
    """Return published posts with viewer-aware aggregate state."""

    return (
        CommunityPost.objects.filter(is_published=True)
        .select_related("author", "game")
        .annotate(
            like_count=Count("reactions", distinct=True),
            comment_count=Count("comments", distinct=True),
            viewer_has_liked=Exists(
                PostReaction.objects.filter(
                    post_id=OuterRef("pk"),
                    user=user,
                ),
            ),
        )
    )


def serialize_posts(posts, request):
    return CommunityPostSerializer(
        posts,
        many=True,
        context={"request": request},
    ).data


def get_owned_game_ids(user):
    return LibraryItem.objects.filter(
        user=user,
        order__status=Order.Status.COMPLETED,
    ).values_list("game_id", flat=True)


def get_owned_library_item(user, game_id: int) -> LibraryItem:
    return get_object_or_404(
        get_library_queryset(user),
        game_id=game_id,
    )


def get_wishlist_queryset(user):
    """Return one user's unowned wishlist with embedded game data preloaded."""

    return (
        GameWishlist.objects.filter(user=user)
        .exclude(game_id__in=get_owned_game_ids(user))
        .select_related("game")
        .prefetch_related("game__genres")
        .order_by("-created_at", "-pk")
    )


class WishlistListView(APIView):
    """List only the authenticated user's personal wishlist."""

    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "head", "options")

    def get(self, request):
        serializer = WishlistItemSerializer(
            get_wishlist_queryset(request.user),
            many=True,
            context={"request": request},
        )
        return Response({"items": serializer.data})


class WishlistItemCreateView(APIView):
    """Add one catalog game to the authenticated user's wishlist."""

    permission_classes = (IsAuthenticated,)
    http_method_names = ("post", "options")

    def post(self, request):
        serializer = WishlistItemCreateSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        item = serializer.save()
        return Response(
            WishlistItemSerializer(
                item,
                context={"request": request},
            ).data,
            status=status.HTTP_201_CREATED,
        )


class WishlistItemDeleteView(APIView):
    """Remove one game from only the authenticated user's wishlist."""

    permission_classes = (IsAuthenticated,)
    http_method_names = ("delete", "options")

    def delete(self, request, game_id: int):
        item = get_object_or_404(
            GameWishlist,
            user=request.user,
            game_id=game_id,
        )
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class LibraryHomeContentView(APIView):
    """Return real news and community cards relevant to owned games."""

    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "head", "options")

    def get(self, request):
        library_items = get_library_queryset(request.user)
        owned_ids = get_owned_game_ids(request.user)
        posts = get_posts_queryset(request.user).filter(
            Q(game_id__in=owned_ids) | Q(game__isnull=True),
        )
        news = posts.filter(kind=CommunityPost.Kind.NEWS).order_by(
            "-created_at",
            "-pk",
        )[:3]
        community = posts.exclude(kind=CommunityPost.Kind.NEWS).order_by(
            "-created_at",
            "-pk",
        )[:3]
        collections = LibraryCollection.objects.filter(
            user=request.user,
        ).prefetch_related("games")
        context = {"request": request}
        return Response(
            {
                "items": OwnedLibraryItemSerializer(
                    library_items,
                    many=True,
                    context=context,
                ).data,
                "collections": LibraryCollectionSerializer(
                    collections,
                    many=True,
                    context=context,
                ).data,
                "news": serialize_posts(news, request),
                "community": serialize_posts(community, request),
            },
        )


class LibraryGameView(APIView):
    """Return the complete data-backed library game screen."""

    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "head", "options")

    def get(self, request, game_id: int):
        item = get_owned_library_item(request.user, game_id)
        game = item.game
        posts = get_posts_queryset(request.user).filter(game=game)
        following_ids = UserFollow.objects.filter(
            follower=request.user,
        ).values_list("following_id", flat=True)
        friends_own = User.objects.filter(
            pk__in=following_ids,
            library_items__game=game,
            library_items__order__status=Order.Status.COMPLETED,
        ).distinct()[:12]
        friends_want = User.objects.filter(
            pk__in=following_ids,
            game_wishlist_items__game=game,
        ).distinct()[:12]
        review = (
            GameReview.objects.prefetch_related("images")
            .filter(
                user=request.user,
                game=game,
            )
            .first()
        )

        context = {"request": request}
        return Response(
            {
                "game": OwnedGameSerializer(game, context=context).data,
                "library_item": OwnedLibraryItemSerializer(
                    item,
                    context=context,
                ).data,
                "review": (
                    GameReviewSerializer(review, context=context).data
                    if review
                    else None
                ),
                "is_wishlisted": GameWishlist.objects.filter(
                    user=request.user,
                    game=game,
                ).exists(),
                "friends_own": UserSummarySerializer(
                    friends_own,
                    many=True,
                    context=context,
                ).data,
                "friends_want": UserSummarySerializer(
                    friends_want,
                    many=True,
                    context=context,
                ).data,
                "news": serialize_posts(
                    posts.filter(kind=CommunityPost.Kind.NEWS).order_by(
                        "-created_at",
                        "-pk",
                    )[:4],
                    request,
                ),
                "community": serialize_posts(
                    posts.exclude(kind=CommunityPost.Kind.NEWS).order_by(
                        "-created_at",
                        "-pk",
                    )[:6],
                    request,
                ),
            },
        )


class LibraryFeedView(APIView):
    """Return a searchable, filterable, real community feed."""

    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "head", "options")

    def get(self, request):
        tab = request.query_params.get("tab", "recommended")
        kind = request.query_params.get("kind", "all")
        search = request.query_params.get("search", "").strip()
        ordering = request.query_params.get("ordering", "popular")
        posts = get_posts_queryset(request.user)

        if tab == "following":
            followed_ids = UserFollow.objects.filter(
                follower=request.user,
            ).values_list("following_id", flat=True)
            posts = posts.filter(author_id__in=followed_ids)
        elif tab == "mine":
            posts = posts.filter(author=request.user)
        elif tab == "library":
            posts = posts.filter(game_id__in=get_owned_game_ids(request.user))
        elif tab != "recommended":
            return Response(
                {"detail": "Unknown feed tab."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid_kinds = {choice for choice, _ in CommunityPost.Kind.choices}
        if kind != "all":
            if kind not in valid_kinds:
                return Response(
                    {"detail": "Unknown feed section."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            posts = posts.filter(kind=kind)

        if search:
            posts = posts.filter(
                Q(title__icontains=search)
                | Q(body__icontains=search)
                | Q(game__title__icontains=search)
                | Q(author__username__icontains=search),
            )

        if ordering == "latest":
            posts = posts.order_by("-created_at", "-pk")
        elif ordering == "popular":
            posts = posts.order_by(
                "-like_count",
                "-comment_count",
                "-created_at",
                "-pk",
            )
        else:
            return Response(
                {"detail": "Unknown feed ordering."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({"items": serialize_posts(posts[:50], request)})


class GameReviewView(APIView):
    permission_classes = (IsAuthenticated,)
    http_method_names = ("post", "put", "patch", "delete", "options")
    max_images = 4

    def post(self, request, game_id: int):
        return self._save(request, game_id, partial=False)

    def put(self, request, game_id: int):
        return self._save(request, game_id, partial=False)

    def patch(self, request, game_id: int):
        return self._save(request, game_id, partial=True)

    @staticmethod
    def _keep_image_ids(request):
        raw_values = request.data.getlist("keep_image_ids") if hasattr(request.data, "getlist") else request.data.get("keep_image_ids", [])
        if not isinstance(raw_values, (list, tuple)):
            raw_values = [raw_values] if raw_values not in (None, "") else []
        try:
            return list(dict.fromkeys(int(value) for value in raw_values))
        except (TypeError, ValueError) as error:
            raise serializers.ValidationError({"images": "Every kept review image must have a valid id."}) from error

    def _save(self, request, game_id: int, partial: bool):
        item = get_owned_library_item(request.user, game_id)
        review = GameReview.objects.prefetch_related("images").filter(user=request.user, game=item.game).first()
        serializer = GameReviewSerializer(review, data=request.data, partial=partial or review is not None, context={"request": request})
        serializer.is_valid(raise_exception=True)
        image_changes = "replace_images" in request.data or "images" in request.FILES
        uploads = request.FILES.getlist("images")
        keep_ids = self._keep_image_ids(request) if image_changes else []
        if any(image_id <= 0 for image_id in keep_ids):
            raise serializers.ValidationError({"images": "Every kept review image must have a valid id."})
        existing_ids = set(review.images.values_list("pk", flat=True) if review else [])
        if set(keep_ids) - existing_ids:
            raise serializers.ValidationError({"images": "A kept image does not belong to this review."})
        if len(keep_ids) + len(uploads) > self.max_images:
            raise serializers.ValidationError({"images": f"A review can contain at most {self.max_images} images."})
        prepared = []
        for upload in uploads:
            image_serializer = GameReviewImageSerializer(data={"image": upload}, context={"request": request})
            image_serializer.is_valid(raise_exception=True)
            prepared.append(image_serializer)

        with transaction.atomic():
            saved_review = serializer.save(user=request.user, game=item.game)
            if image_changes:
                saved_review.images.exclude(pk__in=keep_ids).delete()
                kept = list(saved_review.images.filter(pk__in=keep_ids).order_by("position", "created_at", "pk"))
                for position, image in enumerate(kept):
                    if image.position != position:
                        image.position = position
                        image.save(update_fields=("position", "updated_at"))
                for position, image_serializer in enumerate(prepared, start=len(kept)):
                    image_serializer.save(review=saved_review, position=position)

        saved_review = GameReview.objects.prefetch_related("images").get(pk=saved_review.pk)
        response = GameReviewSerializer(saved_review, context={"request": request})
        return Response(response.data, status=status.HTTP_200_OK if review else status.HTTP_201_CREATED)

    def delete(self, request, game_id: int):
        item = get_owned_library_item(request.user, game_id)
        review = get_object_or_404(GameReview, user=request.user, game=item.game)
        review.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class GameWishlistToggleView(APIView):
    permission_classes = (IsAuthenticated,)
    http_method_names = ("post", "options")

    def post(self, request, game_id: int):
        item = get_owned_library_item(request.user, game_id)
        wishlist_item, created = GameWishlist.objects.get_or_create(
            user=request.user,
            game=item.game,
        )
        if not created:
            wishlist_item.delete()
        return Response({"is_wishlisted": created})


class PostReactionToggleView(APIView):
    permission_classes = (IsAuthenticated,)
    http_method_names = ("post", "options")

    def post(self, request, post_id: int):
        post = get_object_or_404(
            CommunityPost,
            pk=post_id,
            is_published=True,
        )
        reaction, created = PostReaction.objects.get_or_create(
            post=post,
            user=request.user,
        )
        if not created:
            reaction.delete()
        return Response(
            {
                "is_liked": created,
                "like_count": post.reactions.count(),
            },
        )


class PostCommentListCreateView(APIView):
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "post", "head", "options")

    def get_post(self, post_id: int):
        return get_object_or_404(
            CommunityPost,
            pk=post_id,
            is_published=True,
        )

    def get(self, request, post_id: int):
        comments = PostComment.objects.filter(
            post=self.get_post(post_id),
        ).select_related("author")
        serializer = PostCommentSerializer(
            comments,
            many=True,
            context={"request": request},
        )
        return Response({"items": serializer.data})

    def post(self, request, post_id: int):
        post = self.get_post(post_id)
        serializer = PostCommentSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(post=post, author=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
