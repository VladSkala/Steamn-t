from django.urls import path
from .home import HomeShelvesView

from games.views import (
    FeaturedGameListView,
    GameDetailView,
    GameListView,
    GenreListView,
    DLCListView,
    DLCDetailView,
    BundleListView,
    BundleDetailView,
)


app_name = "games"

urlpatterns = [
    path("store/home/", HomeShelvesView.as_view()),
    path("games/", GameListView.as_view(), name="game-list"),
    path("games/featured/", FeaturedGameListView.as_view(), name="featured-game-list"),
    path("games/<int:pk>/", GameDetailView.as_view(), name="game-detail"),
    path("genres/", GenreListView.as_view(), name="genre-list"),
    path("dlc/", DLCListView.as_view(), name="dlc-list"),
    path("dlc/<int:pk>/", DLCDetailView.as_view(), name="dlc-detail"),
    path("bundles/", BundleListView.as_view(), name="bundle-list"),
    path("bundles/<int:pk>/", BundleDetailView.as_view(), name="bundle-detail"),
]
