from django.urls import path

from games.views import GameListView, GenreListView


app_name = "games"

urlpatterns = [
    path("games/", GameListView.as_view(), name="game-list"),
    path("genres/", GenreListView.as_view(), name="genre-list"),
]
