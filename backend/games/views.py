from django.db.models import (
    Avg,
    BooleanField,
    Count,
    Exists,
    OuterRef,
    Prefetch,
    Q,
    Value,
)
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny

from games.filters import GenreFilterBackend, PriceRangeFilterBackend
from games.models import DLC, Game, GameBundle, GameScreenshot, Genre
from games.serializers import (
    GameDetailSerializer,
    GameListSerializer,
    DLCSerializer,
    BundleSerializer,
    GenreSerializer,
)
from store.models import LibraryDLCItem, LibraryItem


FEATURED_GAME_LIMIT = 6


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
        ).filter(Q(order__isnull=True) | Q(order__user=user))
        return queryset.annotate(is_owned=Exists(owned_games))


class GamePageNumberPagination(PageNumberPagination):
    """Bounded page-number pagination for the public game catalog."""

    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 50


class GameListView(OwnershipQuerysetMixin, ListAPIView):
    """Return the searchable, filterable public game catalog."""

    queryset = Game.objects.prefetch_related("genres").all()
    serializer_class = GameListSerializer
    permission_classes = (AllowAny,)
    pagination_class = GamePageNumberPagination
    http_method_names = ("get", "head", "options")
    filter_backends = (
        GenreFilterBackend,
        PriceRangeFilterBackend,
        SearchFilter,
        OrderingFilter,
    )
    search_fields = ("title",)
    ordering_fields = ("price", "title")
    ordering = ("title", "pk")


class FeaturedGameListView(OwnershipQuerysetMixin, ListAPIView):
    """Return a small deterministic selection chosen in Django Admin."""

    queryset = Game.objects.prefetch_related("genres").filter(is_featured=True)
    serializer_class = GameListSerializer
    permission_classes = (AllowAny,)
    pagination_class = None
    http_method_names = ("get", "head", "options")
    max_results = FEATURED_GAME_LIMIT

    def get_queryset(self):
        return super().get_queryset().order_by("title", "pk")[:self.max_results]


class GameDetailView(OwnershipQuerysetMixin, RetrieveAPIView):
    """Return the complete public representation of one game."""

    queryset = (
        Game.objects.annotate(
            average_rating=Avg("reviews__rating"),
            review_count=Count("reviews", distinct=True),
        )
        .prefetch_related(
            "genres",
            Prefetch(
                "screenshots",
                queryset=GameScreenshot.objects.order_by("position", "pk"),
            ),
        )
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


class DLCOwnershipMixin:
    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_authenticated:
            owned = LibraryDLCItem.objects.filter(user=user, dlc_id=OuterRef("pk"))
            return queryset.annotate(is_owned=Exists(owned))
        return queryset.annotate(is_owned=Value(False, output_field=BooleanField()))


class DLCListView(DLCOwnershipMixin, ListAPIView):
    queryset = DLC.objects.filter(is_available=True).select_related("game")
    serializer_class = DLCSerializer
    permission_classes = (AllowAny,)
    pagination_class = GamePageNumberPagination
    http_method_names = ("get", "head", "options")
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = ("title", "description")
    ordering_fields = ("title", "price", "release_date")
    ordering = ("title", "pk")

    def get_queryset(self):
        queryset = super().get_queryset()
        game_id = self.request.query_params.get("game")
        if game_id:
            queryset = queryset.filter(game_id=game_id)
        return queryset


class DLCDetailView(DLCOwnershipMixin, RetrieveAPIView):
    queryset = DLC.objects.filter(is_available=True).select_related("game")
    serializer_class = DLCSerializer
    permission_classes = (AllowAny,)
    http_method_names = ("get", "head", "options")


class BundleListView(ListAPIView):
    queryset = GameBundle.objects.filter(is_available=True).prefetch_related("games", "dlc__game")
    serializer_class = BundleSerializer
    permission_classes = (AllowAny,)
    pagination_class = GamePageNumberPagination
    http_method_names = ("get", "head", "options")


class BundleDetailView(RetrieveAPIView):
    queryset = GameBundle.objects.filter(is_available=True).prefetch_related("games", "dlc__game")
    serializer_class = BundleSerializer
    permission_classes = (AllowAny,)
    http_method_names = ("get", "head", "options")
