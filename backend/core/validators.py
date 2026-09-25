from django.core.exceptions import ValidationError


MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024


def validate_image_size(file_object) -> None:
    """Reject uploaded images larger than five megabytes."""

    if file_object.size > MAX_IMAGE_SIZE_BYTES:
        raise ValidationError("Image size must not exceed 5 MB.")
