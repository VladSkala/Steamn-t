from decimal import Decimal

from rest_framework import serializers
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


class PriceRangeParamsSerializer(serializers.Serializer):
    """Validate catalog price bounds against the Game.price precision."""

    min_price = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("0.00"),
        required=False,
    )
    max_price = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("0.00"),
        required=False,
    )

    def validate(self, attrs):
        min_price = attrs.get("min_price")
        max_price = attrs.get("max_price")
        if min_price is not None and max_price is not None and min_price > max_price:
            raise serializers.ValidationError(
                {"min_price": "Must be less than or equal to max_price."},
            )
        return attrs


class PriceRangeFilterBackend(BaseFilterBackend):
    """Filter catalog games by optional inclusive minimum and maximum prices."""

    parameter_names = ("min_price", "max_price")

    def filter_queryset(self, request, queryset, view):
        raw_params = {
            name: value.strip()
            for name in self.parameter_names
            if (value := request.query_params.get(name)) is not None and value.strip()
        }
        if not raw_params:
            return queryset

        serializer = PriceRangeParamsSerializer(data=raw_params)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data

        if "min_price" in values:
            queryset = queryset.filter(price__gte=values["min_price"])
        if "max_price" in values:
            queryset = queryset.filter(price__lte=values["max_price"])
        return queryset
