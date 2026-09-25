from django.conf import settings
from django.db import models
from django.db.models import F, Q
from .storage import PrivateChatStorage, attachment_path


class Conversation(models.Model):
    user_low = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="conversations_low")
    user_high = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="conversations_high")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("user_low", "user_high"), name="unique_chat_pair"),
            models.CheckConstraint(condition=Q(user_low__lt=F("user_high")), name="ordered_chat_pair"),
        ]
        ordering = ("-updated_at", "-pk")

    def other(self, user):
        return self.user_high if user.pk == self.user_low_id else self.user_low


class Message(models.Model):
    class Kind(models.TextChoices):
        TEXT = "text", "Text"
        IMAGE = "image", "Image"
        FILE = "file", "File"
        VOICE = "voice", "Voice"

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chat_messages")
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.TEXT)
    body = models.CharField(max_length=4000, blank=True)
    attachment = models.FileField(upload_to=attachment_path, storage=PrivateChatStorage(), blank=True, null=True)
    attachment_name = models.CharField(max_length=255, blank=True)
    duration_seconds = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("created_at", "pk")
        indexes = [models.Index(fields=("conversation", "-created_at"), name="chat_message_recent_idx")]


class ConversationPreference(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="preferences")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    muted = models.BooleanField(default=False)
    cleared_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("conversation", "user"), name="unique_chat_preference")]


class ConversationReport(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE)
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    reason = models.CharField(max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved = models.BooleanField(default=False)
