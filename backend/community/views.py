from django.contrib.auth import get_user_model
from django.db.models import Count, Exists, OuterRef, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
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
    GameReviewSerializer,
    OwnedGameSerializer,
    OwnedLibraryItemSerializer,
    PostCommentSerializer,
    UserSummarySerializer,
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
        review = GameReview.objects.filter(
            user=request.user,
            game=game,
        ).first()

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
    """Create, update, or remove the caller's owned-game review."""

    permission_classes = (IsAuthenticated,)
    http_method_names = ("post", "put", "patch", "delete", "options")

    def post(self, request, game_id: int):
        return self._save(request, game_id, partial=False)

    def put(self, request, game_id: int):
        return self._save(request, game_id, partial=False)

    def patch(self, request, game_id: int):
        return self._save(request, game_id, partial=True)

    def _save(self, request, game_id: int, partial: bool):
        item = get_owned_library_item(request.user, game_id)
        review = GameReview.objects.filter(
            user=request.user,
            game=item.game,
        ).first()
        serializer = GameReviewSerializer(
            review,
            data=request.data,
            partial=partial or review is not None,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user, game=item.game)
        return Response(
            serializer.data,
            status=status.HTTP_200_OK if review else status.HTTP_201_CREATED,
        )

    def delete(self, request, game_id: int):
        item = get_owned_library_item(request.user, game_id)
        review = get_object_or_404(
            GameReview,
            user=request.user,
            game=item.game,
        )
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
