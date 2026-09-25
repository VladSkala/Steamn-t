"""Private uploads must never be served by the public MEDIA_URL route."""
from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible


@deconstructible
class PrivateChatStorage(FileSystemStorage):
    def __init__(self):
        super().__init__(location=settings.PRIVATE_MEDIA_ROOT)

    def url(self, name):
        raise ValueError("Private attachments require the authenticated attachment endpoint.")


def attachment_path(instance, filename):
    return f"chat/{instance.conversation_id}/{uuid4().hex}{Path(filename).suffix.lower()}"
