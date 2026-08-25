from rest_framework.exceptions import ValidationError
from rest_framework.filters import BaseFilterBackend


class GenreFilterBackend(BaseFilterBackend):
    """Filter the game catalog by one positive Genre primary key."""

    parameter_name = "genre"
    max_bigint = 9_223_372_036_854_775_807
    error_message = "Must be a positive integer genre id."

    def filter_queryset(self, request, queryset, view):
        raw_genre_id = request.query_params.get(self.parameter_name)

        if raw_genre_id is None or not raw_genre_id.strip():
            return queryset

        try:
            genre_id = int(raw_genre_id)
        except (TypeError, ValueError):
            raise ValidationError(
                {self.parameter_name: self.error_message},
            ) from None

        if not 1 <= genre_id <= self.max_bigint:
            raise ValidationError(
                {self.parameter_name: self.error_message},
            )

        return queryset.filter(genres__id=genre_id)
