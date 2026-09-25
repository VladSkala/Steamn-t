from django.db import IntegrityError, transaction
from rest_framework import serializers

from community.models import GameReview
from community.serializers import GameReviewImageSerializer, GameReviewSerializer
from games.models import Game


MAX_REVIEW_IMAGES = 4
DUPLICATE_REVIEW_MESSAGE = "You have already reviewed this game."
INVALID_KEPT_IMAGE_MESSAGE = "Every kept review image must have a valid id."
FOREIGN_KEPT_IMAGE_MESSAGE = "A kept image does not belong to this review."


def _keep_image_ids(request) -> list[int]:
    raw_values = (
        request.data.getlist("keep_image_ids")
        if hasattr(request.data, "getlist")
        else request.data.get("keep_image_ids", [])
    )
    if not isinstance(raw_values, (list, tuple)):
        raw_values = [raw_values] if raw_values not in (None, "") else []
    try:
        keep_ids = list(dict.fromkeys(int(value) for value in raw_values))
    except (TypeError, ValueError) as error:
        raise serializers.ValidationError({"images": INVALID_KEPT_IMAGE_MESSAGE}) from error
    if any(image_id <= 0 for image_id in keep_ids):
        raise serializers.ValidationError({"images": INVALID_KEPT_IMAGE_MESSAGE})
    return keep_ids


def save_review_from_request(
    *,
    request,
    game: Game,
    review: GameReview | None = None,
    partial: bool = False,
) -> tuple[GameReview, bool]:
    """Validate and atomically persist review text, rating and optional images."""

    serializer = GameReviewSerializer(
        review,
        data=request.data,
        partial=partial,
        context={"request": request},
    )
    serializer.is_valid(raise_exception=True)
    uploads = request.FILES.getlist("images")
    image_changes = "replace_images" in request.data or bool(uploads)
    keep_ids = _keep_image_ids(request) if image_changes else []
    existing_ids = set(review.images.values_list("pk", flat=True) if review else ())
    if set(keep_ids) - existing_ids:
        raise serializers.ValidationError({"images": FOREIGN_KEPT_IMAGE_MESSAGE})
    if len(keep_ids) + len(uploads) > MAX_REVIEW_IMAGES:
        raise serializers.ValidationError(
            {"images": f"A review can contain at most {MAX_REVIEW_IMAGES} images."},
        )
    prepared_images = []
    for upload in uploads:
        image_serializer = GameReviewImageSerializer(
            data={"image": upload},
            context={"request": request},
        )
        image_serializer.is_valid(raise_exception=True)
        prepared_images.append(image_serializer)
    created = review is None
    try:
        with transaction.atomic():
            saved_review = serializer.save(user=request.user, game=game)
            if image_changes:
                saved_review.images.exclude(pk__in=keep_ids).delete()
                kept_images = list(
                    saved_review.images.filter(pk__in=keep_ids).order_by(
                        "position", "created_at", "pk",
                    ),
                )
                for position, image in enumerate(kept_images):
                    if image.position != position:
                        image.position = position
                        image.save(update_fields=("position", "updated_at"))
                for position, image_serializer in enumerate(
                    prepared_images,
                    start=len(kept_images),
                ):
                    image_serializer.save(review=saved_review, position=position)
    except IntegrityError as error:
        raise serializers.ValidationError({"detail": DUPLICATE_REVIEW_MESSAGE}) from error
    return (
        GameReview.objects.select_related("user", "game")
        .prefetch_related("images")
        .get(pk=saved_review.pk),
        created,
    )
