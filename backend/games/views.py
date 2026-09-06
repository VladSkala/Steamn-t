from django.db.models import Avg, BooleanField, Count, Exists, OuterRef, Value
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny

from games.filters import GenreFilterBackend
from games.models import Game, Genre
from games.serializers import (
    GameDetailSerializer,
    GameListSerializer,
    GenreSerializer,
)
from store.models import LibraryItem, Order


class OwnershipQuerysetMixin:
    """Annotate catalog games with ownership without per-row queries."""

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        if not user.is_authenticated:
            return queryset.annotate(
                is_owned=Value(False, output_field=BooleanField()),
            )

        owned_games = LibraryItem.objects.filter(
            user=user,
            game_id=OuterRef("pk"),
            order__user=user,
            order__status=Order.Status.COMPLETED,
        )
        return queryset.annotate(is_owned=Exists(owned_games))


class GameListView(OwnershipQuerysetMixin, ListAPIView):
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


class GameDetailView(OwnershipQuerysetMixin, RetrieveAPIView):
    """Return the complete public representation of one game."""

    queryset = (
        Game.objects.annotate(
            average_rating=Avg("reviews__rating"),
            review_count=Count("reviews", distinct=True),
        )
        .prefetch_related("genres", "screenshots")
        .all()
    )
    serializer_class = GameDetailSerializer
    permission_classes = (AllowAny,)
    http_method_names = ("get", "head", "options")


class GenreListView(ListAPIView):
    """Return all public catalog genres."""

    queryset = Genre.objects.all()
    serializer_class = GenreSerializer
    permission_classes = (AllowAny,)
    pagination_class = None
    http_method_names = ("get", "head", "options")
