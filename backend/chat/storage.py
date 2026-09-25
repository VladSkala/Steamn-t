"""Private chat attachments are stored separately from public media."""
from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible


if getattr(settings, "USE_S3_STORAGE", False):
    from storages.s3 import S3Storage

    @deconstructible
    class PrivateChatStorage(S3Storage):
        """Use the private Neon bucket while keeping attachment URLs hidden."""

        def __init__(self):
            options = dict(settings.NEON_S3_COMMON_OPTIONS)
            options.update(
                {
                    "bucket_name": settings.NEON_PRIVATE_BUCKET,
                    "querystring_auth": True,
                }
            )
            super().__init__(**options)

        def url(self, name):
            raise ValueError(
                "Private attachments require the authenticated attachment endpoint."
            )
else:

    @deconstructible
    class PrivateChatStorage(FileSystemStorage):
        def __init__(self):
            super().__init__(location=settings.PRIVATE_MEDIA_ROOT)

        def url(self, name):
            raise ValueError(
                "Private attachments require the authenticated attachment endpoint."
            )


def attachment_path(instance, filename):
    return f"chat/{instance.conversation_id}/{uuid4().hex}{Path(filename).suffix.lower()}"
