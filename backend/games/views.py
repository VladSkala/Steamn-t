from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny

from games.models import Game, Genre
from games.serializers import GameListSerializer, GenreSerializer


class GameListView(ListAPIView):
    """Return the public, unpaginated game catalog."""

    queryset = Game.objects.prefetch_related("genres").all()
    serializer_class = GameListSerializer
    permission_classes = (AllowAny,)
    pagination_class = None
    http_method_names = ("get", "head", "options")


class GenreListView(ListAPIView):
    """Return all public catalog genres."""

    queryset = Genre.objects.all()
    serializer_class = GenreSerializer
    permission_classes = (AllowAny,)
    pagination_class = None
    http_method_names = ("get", "head", "options")
