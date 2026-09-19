from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Avg, BooleanField, Count, Exists, OuterRef, Q, Value
from django.db.models.functions import Lower
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.exceptions import NotAuthenticated, PermissionDenied
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from community.models import (
    CommunityPost,
    Friendship,
    GameReview,
    GameWishlist,
    PostComment,
    PostReaction,
    UserFollow,
)
from community.serializers import (
    CommunityPostSerializer,
    CommunityPostWriteSerializer,
    FriendRequestCreateSerializer,
    FriendSearchResultSerializer,
    FriendshipSerializer,
    GameReviewSerializer,
    MyReviewSerializer,
    OwnedGameSerializer,
    OwnedLibraryItemSerializer,
    PostCommentSerializer,
    UserSummarySerializer,
    WishlistItemCreateSerializer,
    WishlistItemSerializer,
)
from community.friendship_services import (
    accept_friend_request,
    accepted_friend_ids,
    cancel_friend_request,
    reject_friend_request,
    remove_friendship,
    send_friend_request,
)
from community.review_services import (
    DUPLICATE_REVIEW_MESSAGE,
    save_review_from_request,
)
from games.models import Game
from store.models import LibraryCollection, LibraryItem
from store.serializers import LibraryCollectionSerializer
from store.views import get_library_queryset


User = get_user_model()


def get_posts_queryset(user):
    """Return published posts with safe viewer-aware aggregate state."""

    viewer_has_liked = Value(False, output_field=BooleanField())
    if user.is_authenticated:
        viewer_has_liked = Exists(
            PostReaction.objects.filter(
                post_id=OuterRef("pk"),
                user=user,
            ),
        )

    return (
        CommunityPost.objects.filter(is_published=True)
        .select_related("author", "game")
        .annotate(
            like_count=Count("reactions", distinct=True),
            comment_count=Count("comments", distinct=True),
            viewer_has_liked=viewer_has_liked,
        )
    )


def serialize_posts(posts, request):
    return CommunityPostSerializer(
        posts,
        many=True,
        context={"request": request},
    ).data


def get_owned_game_ids(user):
    return LibraryItem.objects.filter(user=user).filter(Q(order__isnull=True) | Q(order__user=user)).values_list("game_id", flat=True)


def get_followed_user_ids(user):
    """Return the directional subscriptions used by the Following feed."""

    return UserFollow.objects.filter(follower=user).values_list(
        "following_id",
        flat=True,
    )


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
        friend_ids = accepted_friend_ids(request.user)
        friends_own = User.objects.filter(
            pk__in=friend_ids,
            library_items__game=game,
        ).distinct()[:12]
        friends_want = User.objects.filter(
            pk__in=accepted_friend_ids(request.user),
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
                "is_favorite": item.is_favorite,
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
            posts = posts.filter(author_id__in=get_followed_user_ids(request.user))
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


class CommunityPostPageNumberPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 30


class CommunityPostFeedView(APIView):
    """Public published feed plus authenticated, owner-bound post creation."""

    http_method_names = ("get", "post", "head", "options")

    def get_permissions(self):
        classes = (IsAuthenticated,) if self.request.method == "POST" else (AllowAny,)
        return [permission() for permission in classes]

    def get(self, request, game_id=None):
        scope = request.query_params.get("scope", "all")
        kind = request.query_params.get("kind", "all")
        search = request.query_params.get("search", "").strip()
        ordering = request.query_params.get("ordering", "latest")
        posts = get_posts_queryset(request.user)
        requested_game = game_id or request.query_params.get("game")
        if requested_game:
            try:
                requested_game = int(requested_game)
            except (TypeError, ValueError):
                return Response({"detail": "Invalid game id."}, status=400)
            if not Game.objects.filter(pk=requested_game).exists():
                raise Http404
            posts = posts.filter(game_id=requested_game)

        protected_scopes = {"friends", "following", "mine", "library"}
        valid_scopes = {"all", *protected_scopes}
        if scope not in valid_scopes:
            return Response(
                {"detail": "Unknown community scope."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if scope in protected_scopes and not request.user.is_authenticated:
            raise NotAuthenticated("Sign in to use this community filter.")
        if scope == "friends":
            posts = posts.filter(author_id__in=accepted_friend_ids(request.user))
        elif scope == "following":
            posts = posts.filter(author_id__in=get_followed_user_ids(request.user))
        elif scope == "mine":
            posts = posts.filter(author=request.user)
        elif scope == "library":
            posts = posts.filter(game_id__in=get_owned_game_ids(request.user))

        valid_kinds = {choice for choice, _label in CommunityPost.Kind.choices}
        if kind != "all":
            if kind not in valid_kinds:
                return Response(
                    {"detail": "Unknown community section."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            posts = posts.filter(kind=kind)

        if search:
            posts = posts.filter(
                Q(title__icontains=search)
                | Q(body__icontains=search)
                | Q(game__title__icontains=search)
                | Q(author__username__icontains=search)
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
                {"detail": "Unknown community ordering."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        paginator = CommunityPostPageNumberPagination()
        page = paginator.paginate_queryset(posts, request, view=self)
        return Response(
            {
                "items": serialize_posts(page, request),
                "pagination": {
                    "page": paginator.page.number,
                    "page_size": paginator.get_page_size(request),
                    "total_pages": paginator.page.paginator.num_pages,
                    "count": paginator.page.paginator.count,
                    "next": paginator.get_next_link(),
                    "previous": paginator.get_previous_link(),
                },
            }
        )

    def post(self, request):
        serializer = CommunityPostWriteSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        post = serializer.save(
            author=request.user,
            is_published=True,
        )
        post = get_posts_queryset(request.user).get(pk=post.pk)
        return Response(
            CommunityPostSerializer(
                post,
                context={"request": request},
            ).data,
            status=status.HTTP_201_CREATED,
        )


class CommunityPostDetailView(APIView):
    """Read one public post and restrict edits/deletion to its author."""

    http_method_names = ("get", "patch", "delete", "head", "options")

    def get_permissions(self):
        classes = (
            (AllowAny,)
            if self.request.method in ("GET", "HEAD", "OPTIONS")
            else (IsAuthenticated,)
        )
        return [permission() for permission in classes]

    @staticmethod
    def get_post(request, post_id: int):
        return get_object_or_404(get_posts_queryset(request.user), pk=post_id)

    @staticmethod
    def ensure_owner(request, post: CommunityPost) -> None:
        if post.author_id != request.user.pk:
            raise PermissionDenied("You can only modify your own post.")

    def get(self, request, post_id: int):
        post = self.get_post(request, post_id)
        return Response(
            CommunityPostSerializer(post, context={"request": request}).data
        )

    def patch(self, request, post_id: int):
        post = self.get_post(request, post_id)
        self.ensure_owner(request, post)
        serializer = CommunityPostWriteSerializer(
            post,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        old_media = post.media_file.name if post.media_file else ""
        storage = post.media_file.storage if post.media_file else None
        serializer.save()
        if old_media and storage and old_media != (post.media_file.name if post.media_file else ""):
            transaction.on_commit(lambda: storage.delete(old_media))
        refreshed = get_posts_queryset(request.user).get(pk=post.pk)
        return Response(
            CommunityPostSerializer(
                refreshed,
                context={"request": request},
            ).data
        )

    def delete(self, request, post_id: int):
        post = self.get_post(request, post_id)
        self.ensure_owner(request, post)
        post.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class FriendsOverviewView(APIView):
    """Return accepted, incoming, and outgoing relationships for one user."""

    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "head", "options")

    def get(self, request):
        relationships = list(
            Friendship.objects.filter(
                Q(user_low=request.user) | Q(user_high=request.user)
            ).select_related("user_low", "user_high", "requested_by")
        )
        serialized = FriendshipSerializer(
            relationships,
            many=True,
            context={"request": request, "viewer": request.user},
        ).data
        groups = {"friends": [], "incoming": [], "outgoing": []}
        for item in serialized:
            status_name = item["relationship_status"]
            key = "friends" if status_name == "friend" else status_name
            groups[key].append(item)
        for items in groups.values():
            items.sort(
                key=lambda item: (
                    item["user"]["username"].casefold(),
                    item["user"]["id"],
                )
            )
        friend_ids = [item["user"]["id"] for item in groups["friends"]]
        activity = CommunityPost.objects.filter(author_id__in=friend_ids, author__privacy_activity=True, is_published=True).select_related("author", "game").order_by("-created_at", "-pk")[:10]
        groups["activity"] = [{"id": post.pk, "title": post.title, "username": post.author.username, "user_id": post.author_id, "kind": post.kind, "game": post.game.title if post.game else None, "created_at": post.created_at} for post in activity]
        return Response(groups)


class FriendSearchView(APIView):
    """Search active public identities and include viewer-relative status."""

    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "head", "options")

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if len(query) < 2:
            return Response({"items": []})
        candidates = list(
            User.objects.filter(is_active=True)
            .exclude(pk=request.user.pk)
            .filter(
                Q(username__icontains=query)
                | Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
            )
            .order_by(Lower("username"), "pk")[:20]
        )
        candidate_ids = [candidate.pk for candidate in candidates]
        relationships = Friendship.objects.filter(
            Q(user_low=request.user, user_high_id__in=candidate_ids)
            | Q(user_high=request.user, user_low_id__in=candidate_ids)
        )
        relationship_map = {}
        for relationship in relationships:
            other_id = (
                relationship.user_high_id
                if relationship.user_low_id == request.user.pk
                else relationship.user_low_id
            )
            relationship_map[other_id] = relationship
        serializer = FriendSearchResultSerializer(
            candidates,
            many=True,
            context={
                "request": request,
                "viewer": request.user,
                "relationship_map": relationship_map,
            },
        )
        return Response({"items": serializer.data})


class FriendRequestCreateView(APIView):
    permission_classes = (IsAuthenticated,)
    http_method_names = ("post", "options")

    def post(self, request):
        serializer = FriendRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        relationship = send_friend_request(
            sender=request.user,
            recipient=serializer.validated_data["recipient"],
        )
        relationship = Friendship.objects.select_related(
            "user_low", "user_high", "requested_by"
        ).get(pk=relationship.pk)
        return Response(
            FriendshipSerializer(
                relationship,
                context={"request": request, "viewer": request.user},
            ).data,
            status=status.HTTP_201_CREATED,
        )


class FriendRequestAcceptView(APIView):
    permission_classes = (IsAuthenticated,)
    http_method_names = ("post", "options")

    def post(self, request, request_id: int):
        relationship = accept_friend_request(
            relationship_id=request_id,
            recipient=request.user,
        )
        return Response(
            FriendshipSerializer(
                relationship,
                context={"request": request, "viewer": request.user},
            ).data
        )


class FriendRequestRejectView(APIView):
    permission_classes = (IsAuthenticated,)
    http_method_names = ("post", "options")

    def post(self, request, request_id: int):
        reject_friend_request(
            relationship_id=request_id,
            recipient=request.user,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class FriendRequestCancelView(APIView):
    permission_classes = (IsAuthenticated,)
    http_method_names = ("post", "options")

    def post(self, request, request_id: int):
        cancel_friend_request(
            relationship_id=request_id,
            sender=request.user,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class FriendRemoveView(APIView):
    permission_classes = (IsAuthenticated,)
    http_method_names = ("delete", "options")

    def delete(self, request, user_id: int):
        other_user = get_object_or_404(User, pk=user_id, is_active=True)
        remove_friendship(user=request.user, other_user=other_user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReviewPageNumberPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50


class MyReviewListView(ListAPIView):
    """Return only the authenticated user's reviews, newest update first."""

    serializer_class = MyReviewSerializer
    permission_classes = (IsAuthenticated,)
    pagination_class = ReviewPageNumberPagination
    http_method_names = ("get", "head", "options")

    def get_queryset(self):
        return (
            GameReview.objects.filter(user=self.request.user)
            .select_related("game")
            .prefetch_related("images")
            .order_by("-updated_at", "-pk")
        )


class GameReviewCollectionView(APIView):
    """List public game reviews and let confirmed owners publish one review."""

    http_method_names = ("get", "post", "head", "options")

    def get_permissions(self):
        classes = (IsAuthenticated,) if self.request.method == "POST" else (AllowAny,)
        return [permission() for permission in classes]

    @staticmethod
    def get_game(game_id: int) -> Game:
        return get_object_or_404(Game, pk=game_id)

    @staticmethod
    def get_reviews(game: Game):
        return (
            GameReview.objects.filter(game=game)
            .select_related("user")
            .prefetch_related("images")
            .order_by("-updated_at", "-pk")
        )

    def get(self, request, game_id: int):
        game = self.get_game(game_id)
        reviews = self.get_reviews(game)
        aggregates = reviews.aggregate(
            average_rating=Avg("rating"),
            review_count=Count("pk"),
        )
        distribution = {str(rating): 0 for rating in range(1, 6)}
        distribution_rows = (
            reviews.order_by()
            .values("rating")
            .annotate(review_total=Count("pk"))
        )
        for row in distribution_rows:
            distribution[str(row["rating"])] = row["review_total"]

        paginator = ReviewPageNumberPagination()
        page = paginator.paginate_queryset(reviews, request, view=self)
        viewer_review = None
        if request.user.is_authenticated:
            viewer_review = reviews.filter(user=request.user).first()
        average = aggregates["average_rating"]
        context = {"request": request}
        return Response(
            {
                "game_id": game.pk,
                "average_rating": f"{average:.2f}" if average is not None else None,
                "review_count": aggregates["review_count"],
                "rating_distribution": distribution,
                "viewer_review": (
                    GameReviewSerializer(viewer_review, context=context).data
                    if viewer_review
                    else None
                ),
                "pagination": {
                    "page": paginator.page.number,
                    "page_size": paginator.get_page_size(request),
                    "total_pages": paginator.page.paginator.num_pages,
                    "next": paginator.get_next_link(),
                    "previous": paginator.get_previous_link(),
                },
                "reviews": GameReviewSerializer(
                    page,
                    many=True,
                    context=context,
                ).data,
            },
        )

    def post(self, request, game_id: int):
        game = self.get_game(game_id)
        get_owned_library_item(request.user, game.pk)
        if GameReview.objects.filter(user=request.user, game=game).exists():
            raise serializers.ValidationError({"detail": DUPLICATE_REVIEW_MESSAGE})
        review, _created = save_review_from_request(
            request=request,
            game=game,
            partial=False,
        )
        return Response(
            GameReviewSerializer(review, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class GameReviewDetailView(APIView):
    """Return one public review and protect all mutations by its author."""

    http_method_names = ("get", "put", "patch", "delete", "head", "options")

    def get_permissions(self):
        classes = (
            (AllowAny,)
            if self.request.method in ("GET", "HEAD", "OPTIONS")
            else (IsAuthenticated,)
        )
        return [permission() for permission in classes]

    @staticmethod
    def get_review(game_id: int, review_id: int) -> GameReview:
        return get_object_or_404(
            GameReview.objects.select_related("user", "game").prefetch_related("images"),
            pk=review_id,
            game_id=game_id,
        )

    @staticmethod
    def ensure_owner(request, review: GameReview) -> None:
        if review.user_id != request.user.pk:
            raise PermissionDenied("You can only modify your own review.")

    def get(self, request, game_id: int, review_id: int):
        review = self.get_review(game_id, review_id)
        return Response(
            GameReviewSerializer(review, context={"request": request}).data,
        )

    def put(self, request, game_id: int, review_id: int):
        return self._update(request, game_id, review_id, partial=False)

    def patch(self, request, game_id: int, review_id: int):
        return self._update(request, game_id, review_id, partial=True)

    def _update(self, request, game_id: int, review_id: int, partial: bool):
        review = self.get_review(game_id, review_id)
        self.ensure_owner(request, review)
        saved_review, _created = save_review_from_request(
            request=request,
            game=review.game,
            review=review,
            partial=partial,
        )
        return Response(
            GameReviewSerializer(saved_review, context={"request": request}).data,
        )

    def delete(self, request, game_id: int, review_id: int):
        review = self.get_review(game_id, review_id)
        self.ensure_owner(request, review)
        review.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class GameReviewView(APIView):
    """Backward-compatible current-user review endpoint used by Library UI."""

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
        review = (
            GameReview.objects.prefetch_related("images")
            .filter(user=request.user, game=item.game)
            .first()
        )
        saved_review, created = save_review_from_request(
            request=request,
            game=item.game,
            review=review,
            partial=partial or review is not None,
        )
        return Response(
            GameReviewSerializer(saved_review, context={"request": request}).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, game_id: int):
        item = get_owned_library_item(request.user, game_id)
        review = get_object_or_404(GameReview, user=request.user, game=item.game)
        review.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class GameFavoriteToggleView(APIView):
    """Toggle library-only favorite state without mutating Wishlist."""

    permission_classes = (IsAuthenticated,)
    http_method_names = ("post", "options")

    @transaction.atomic
    def post(self, request, game_id: int):
        item = get_object_or_404(
            LibraryItem.objects.select_for_update(),
            user=request.user,
            game_id=game_id,
        )
        item.is_favorite = not item.is_favorite
        item.save(update_fields=("is_favorite", "updated_at"))
        return Response({"is_favorite": item.is_favorite})


class LegacyGameWishlistToggleView(APIView):
    """Redirect legacy clients to the canonical favorite action."""

    permission_classes = (IsAuthenticated,)
    http_method_names = ("post", "options")

    def post(self, request, game_id: int):
        get_owned_library_item(request.user, game_id)
        successor = f"/api/library/games/{game_id}/favorite/"
        response = Response(status=status.HTTP_308_PERMANENT_REDIRECT)
        response["Location"] = successor
        response["Deprecation"] = "true"
        response["Link"] = f'<{successor}>; rel="successor-version"'
        return response


class PostReactionToggleView(APIView):
    permission_classes = (IsAuthenticated,)
    http_method_names = ("post", "options")

    @transaction.atomic
    def post(self, request, post_id: int):
        post = get_object_or_404(
            CommunityPost.objects.select_for_update(),
            pk=post_id,
            is_published=True,
        )
        from users.social_services import has_block_between
        if has_block_between(request.user, post.author):
            return Response({"detail": "This interaction is unavailable."}, status=403)
        reaction = PostReaction.objects.filter(
            post=post,
            user=request.user,
        ).first()
        if reaction:
            reaction.delete()
            is_liked = False
        else:
            PostReaction.objects.create(post=post, user=request.user)
            is_liked = True
        return Response(
            {
                "is_liked": is_liked,
                "like_count": post.reactions.count(),
            },
        )


class PostCommentListCreateView(APIView):
    http_method_names = ("get", "post", "head", "options")

    def get_permissions(self):
        classes = (IsAuthenticated,) if self.request.method == "POST" else (AllowAny,)
        return [permission() for permission in classes]

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
        from users.social_services import has_block_between
        if has_block_between(request.user, post.author):
            return Response({"detail": "This interaction is unavailable."}, status=403)
        serializer = PostCommentSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(post=post, author=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PostCommentDetailView(APIView):
    permission_classes = (IsAuthenticated,)

    def patch(self, request, post_id, comment_id):
        comment = get_object_or_404(PostComment, pk=comment_id, post_id=post_id, author=request.user, post__is_published=True)
        serializer = PostCommentSerializer(comment, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, post_id, comment_id):
        comment = get_object_or_404(PostComment, pk=comment_id, post_id=post_id, author=request.user)
        comment.delete()
        return Response(status=204)
