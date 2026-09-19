from django.urls import path

from community.views import (
    CommunityPostDetailView,
    CommunityPostFeedView,
    FriendRemoveView,
    FriendRequestAcceptView,
    FriendRequestCancelView,
    FriendRequestCreateView,
    FriendRequestRejectView,
    FriendSearchView,
    FriendsOverviewView,
    GameReviewCollectionView,
    GameReviewDetailView,
    GameReviewView,
    GameFavoriteToggleView,
    LegacyGameWishlistToggleView,
    LibraryFeedView,
    LibraryGameView,
    LibraryHomeContentView,
    MyReviewListView,
    PostCommentListCreateView,
    PostCommentDetailView,
    PostReactionToggleView,
    WishlistItemCreateView,
    WishlistItemDeleteView,
    WishlistListView,
)


app_name = "community"

urlpatterns = [
    path("library/posts/<int:post_id>/comments/<int:comment_id>/", PostCommentDetailView.as_view()),
    path("community/posts/", CommunityPostFeedView.as_view(), name="community-posts"),
    path(
        "community/posts/<int:post_id>/",
        CommunityPostDetailView.as_view(),
        name="community-post-detail",
    ),
    path("friends/", FriendsOverviewView.as_view(), name="friends-overview"),
    path("friends/search/", FriendSearchView.as_view(), name="friend-search"),
    path(
        "friends/requests/",
        FriendRequestCreateView.as_view(),
        name="friend-request-create",
    ),
    path(
        "friends/requests/<int:request_id>/accept/",
        FriendRequestAcceptView.as_view(),
        name="friend-request-accept",
    ),
    path(
        "friends/requests/<int:request_id>/reject/",
        FriendRequestRejectView.as_view(),
        name="friend-request-reject",
    ),
    path(
        "friends/requests/<int:request_id>/cancel/",
        FriendRequestCancelView.as_view(),
        name="friend-request-cancel",
    ),
    path(
        "friends/<int:user_id>/",
        FriendRemoveView.as_view(),
        name="friend-remove",
    ),
    path("reviews/my/", MyReviewListView.as_view(), name="my-reviews"),
    path(
        "games/<int:game_id>/reviews/",
        GameReviewCollectionView.as_view(),
        name="game-review-list",
    ),
    path(
        "games/<int:game_id>/reviews/<int:review_id>/",
        GameReviewDetailView.as_view(),
        name="game-review-detail",
    ),
    path("wishlist/", WishlistListView.as_view(), name="wishlist"),
    path(
        "wishlist/items/",
        WishlistItemCreateView.as_view(),
        name="wishlist-item-create",
    ),
    path(
        "wishlist/items/<int:game_id>/",
        WishlistItemDeleteView.as_view(),
        name="wishlist-item-delete",
    ),
    path("library/home/", LibraryHomeContentView.as_view(), name="library-home"),
    path("library/feed/", LibraryFeedView.as_view(), name="library-feed"),
    path(
        "library/games/<int:game_id>/",
        LibraryGameView.as_view(),
        name="library-game",
    ),
    path(
        "library/games/<int:game_id>/review/",
        GameReviewView.as_view(),
        name="game-review",
    ),
    path(
        "library/games/<int:game_id>/favorite/",
        GameFavoriteToggleView.as_view(),
        name="game-favorite",
    ),
    path(
        "library/games/<int:game_id>/wishlist/",
        LegacyGameWishlistToggleView.as_view(),
        name="legacy-game-wishlist",
    ),
    path(
        "library/posts/<int:post_id>/reaction/",
        PostReactionToggleView.as_view(),
        name="post-reaction",
    ),
    path(
        "library/posts/<int:post_id>/comments/",
        PostCommentListCreateView.as_view(),
        name="post-comments",
    ),
]
