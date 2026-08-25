from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny

from games.filters import GenreFilterBackend
from games.models import Game, Genre
from games.serializers import GameListSerializer, GenreSerializer


class GameListView(ListAPIView):
    """Return the searchable, filterable public game catalog."""

    queryset = Game.objects.prefetch_related("genres").all()
    serializer_class = GameListSerializer
    permission_classes = (AllowAny,)
    pagination_class = None
    http_method_names = ("get", "head", "options")
    filter_backends = (GenreFilterBackend, SearchFilter, OrderingFilter)
    search_fields = ("title",)
    ordering_fields = ("price", "title")
    ordering = ("title", "pk")


class GenreListView(ListAPIView):
    """Return all public catalog genres."""

    queryset = Genre.objects.all()
    serializer_class = GenreSerializer
    permission_classes = (AllowAny,)
    pagination_class = None
    http_method_names = ("get", "head", "options")
