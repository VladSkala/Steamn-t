from django.urls import path

from games.views import GameDetailView, GameListView, GenreListView


app_name = "games"

urlpatterns = [
    path("games/", GameListView.as_view(), name="game-list"),
    path("games/<int:pk>/", GameDetailView.as_view(), name="game-detail"),
    path("genres/", GenreListView.as_view(), name="genre-list"),
]
