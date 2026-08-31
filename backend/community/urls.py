from django.urls import path

from community.views import (
    GameReviewView,
    GameWishlistToggleView,
    LibraryFeedView,
    LibraryGameView,
    LibraryHomeContentView,
    PostCommentListCreateView,
    PostReactionToggleView,
)


app_name = "community"

urlpatterns = [
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
        "library/games/<int:game_id>/wishlist/",
        GameWishlistToggleView.as_view(),
        name="game-wishlist",
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
