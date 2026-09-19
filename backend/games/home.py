from django.db.models import Avg, Count, Exists, OuterRef, Q, Value, BooleanField, F
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Game, Genre, GameBundle
from .serializers import GameListSerializer, GenreSerializer, BundleSerializer
from store.models import LibraryItem


class HomeShelvesView(APIView):
    permission_classes = (AllowAny,)

    def get(self, request):
        games = Game.objects.prefetch_related("genres").annotate(rating=Avg("reviews__rating"), review_total=Count("reviews", distinct=True))
        if request.user.is_authenticated:
            owned = LibraryItem.objects.filter(user=request.user).filter(Q(order__isnull=True) | Q(order__user=request.user))
            games = games.annotate(is_owned=Exists(owned.filter(game_id=OuterRef("pk"))))
            genres = Genre.objects.filter(games__id__in=owned.values("game_id")).values("id")
            recommendations = games.filter(genres__in=genres, is_owned=False).distinct().order_by(F("rating").desc(nulls_last=True), "-review_total", "-release_date", "pk")
            reason = "Based on genres in your library"
        else:
            games = games.annotate(is_owned=Value(False, output_field=BooleanField()))
            recommendations = games.none()
            reason = "Discover highly rated and recent releases"
        if not recommendations.exists():
            recommendations = games.filter(is_owned=False).order_by("-review_total", "-rating", "-release_date", "pk")
            reason = "Discover highly rated and recent releases"
        serialize = lambda queryset, limit: GameListSerializer(queryset[:limit], many=True, context={"request": request}).data
        return Response({
            "recommendations": serialize(recommendations, 4), "recommendation_reason": reason,
            "recent": serialize(games.order_by("-release_date", "pk"), 6),
            "budget": serialize(games.filter(price__gt=0, price__lt=20).order_by("price", "pk"), 4),
            "free": serialize(games.filter(price=0).order_by("-release_date", "pk"), 3),
            "popular": serialize(games.order_by("-review_total", "-rating", "pk"), 3),
            "genres": GenreSerializer(Genre.objects.all(), many=True).data,
            "bundles": BundleSerializer(GameBundle.objects.filter(is_available=True).prefetch_related("games__genres", "dlc__game__genres").order_by("price", "pk")[:3], many=True, context={"request": request}).data,
        })
