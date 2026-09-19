from pathlib import Path
from PIL import Image, UnidentifiedImageError

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import UserBlock
from .models import Conversation, Message, ConversationPreference, ConversationReport


User = get_user_model()


def accessible_conversations(user):
    return Conversation.objects.filter(Q(user_low=user) | Q(user_high=user)).select_related("user_low", "user_high")


def is_blocked(a, b):
    return UserBlock.objects.filter(Q(blocker=a, blocked=b) | Q(blocker=b, blocked=a)).exists()


def can_message(sender, recipient):
    if not recipient.is_active or is_blocked(sender, recipient) or recipient.privacy_messages == "nobody":
        return False
    if recipient.privacy_messages == "friends":
        from community.models import Friendship
        low, high = sorted((sender.pk, recipient.pk))
        return Friendship.objects.filter(user_low_id=low, user_high_id=high, status="accepted").exists()
    return True


def visible_messages(conversation, user):
    messages = conversation.messages.all()
    preference = ConversationPreference.objects.filter(conversation=conversation, user=user).first()
    if preference and preference.cleared_at:
        messages = messages.filter(created_at__gt=preference.cleared_at)
    return messages


def user_payload(user):
    return {"id": user.pk, "username": user.username, "avatar": user.avatar.url if user.avatar else None, "is_online": user.is_online}


def message_payload(message):
    return {"id": message.pk, "sender_id": message.sender_id, "kind": message.kind, "body": message.body,
            "attachment_name": message.attachment_name, "duration_seconds": message.duration_seconds,
            "has_attachment": bool(message.attachment), "created_at": message.created_at, "read_at": message.read_at}


class ChatPagination(PageNumberPagination):
    page_size = 30
    page_size_query_param = "page_size"
    max_page_size = 100


class ConversationListView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        rows = []
        for conversation in accessible_conversations(request.user)[:100]:
            messages = visible_messages(conversation, request.user)
            last = messages.order_by("-created_at", "-pk").first()
            rows.append({"id": conversation.pk, "other_user": user_payload(conversation.other(request.user)),
                         "last_message": message_payload(last) if last else None,
                         "unread_count": messages.filter(read_at__isnull=True).exclude(sender=request.user).count(),
                         "updated_at": conversation.updated_at})
        return Response({"items": rows})

    def post(self, request):
        other = get_object_or_404(User, pk=request.data.get("user_id"), is_active=True)
        if other.pk == request.user.pk:
            return Response({"detail": "Choose another user."}, status=400)
        if is_blocked(request.user, other):
            return Response({"detail": "This conversation is unavailable."}, status=403)
        if other.privacy_messages == "nobody":
            return Response({"detail": "This user does not accept messages."}, status=403)
        if other.privacy_messages == "friends":
            from community.models import Friendship
            low, high = sorted((request.user.pk, other.pk))
            if not Friendship.objects.filter(user_low_id=low, user_high_id=high, status=Friendship.Status.ACCEPTED).exists():
                return Response({"detail": "Only friends can message this user."}, status=403)
        low, high = sorted((request.user.pk, other.pk))
        conversation, _ = Conversation.objects.get_or_create(user_low_id=low, user_high_id=high)
        return Response({"id": conversation.pk, "other_user": user_payload(other)}, status=status.HTTP_200_OK)


class ConversationDetailView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request, conversation_id):
        conversation = get_object_or_404(accessible_conversations(request.user), pk=conversation_id)
        preference = ConversationPreference.objects.filter(conversation=conversation, user=request.user).first()
        other = conversation.other(request.user)
        return Response({"id": conversation.pk, "other_user": user_payload(other),
                         "muted": bool(preference and preference.muted),
                         "blocked": UserBlock.objects.filter(blocker=request.user, blocked=other).exists(),
                         "can_message": can_message(request.user, other)})

    def patch(self, request, conversation_id):
        conversation = get_object_or_404(accessible_conversations(request.user), pk=conversation_id)
        if not isinstance(request.data.get("muted"), bool):
            return Response({"detail": "muted must be a boolean."}, status=400)
        ConversationPreference.objects.update_or_create(conversation=conversation, user=request.user, defaults={"muted": request.data["muted"]})
        return self.get(request, conversation_id)

    def delete(self, request, conversation_id):
        conversation = get_object_or_404(accessible_conversations(request.user), pk=conversation_id)
        ConversationPreference.objects.update_or_create(conversation=conversation, user=request.user, defaults={"cleared_at": timezone.now()})
        return Response(status=204)


class MessageListView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request, conversation_id):
        conversation = get_object_or_404(accessible_conversations(request.user), pk=conversation_id)
        paginator = ChatPagination()
        messages = visible_messages(conversation, request.user)
        kind = request.query_params.get("kind")
        if kind in ("image", "voice", "file"):
            messages = messages.filter(kind=kind)
        before = request.query_params.get("before")
        if before and before.isdigit():
            messages = messages.filter(pk__lt=int(before))
        page = paginator.paginate_queryset(messages.order_by("-created_at", "-pk"), request, view=self)
        return paginator.get_paginated_response([message_payload(message) for message in page])

    @transaction.atomic
    def post(self, request, conversation_id):
        conversation = get_object_or_404(accessible_conversations(request.user), pk=conversation_id)
        if not can_message(request.user, conversation.other(request.user)):
            return Response({"detail": "This conversation is unavailable."}, status=403)
        body = str(request.data.get("body", "")).strip()
        upload = request.FILES.get("attachment")
        kind = request.data.get("kind", "text")
        if kind not in Message.Kind.values:
            return Response({"detail": "Unsupported message type."}, status=400)
        if not body and not upload:
            return Response({"detail": "Write a message or attach a file."}, status=400)
        if len(body) > 4000:
            return Response({"detail": "Message is too long."}, status=400)
        if upload:
            suffix = Path(upload.name).suffix.lower()
            allowed = {"image": {".jpg", ".jpeg", ".png", ".webp"},
                       "voice": {".mp3", ".m4a", ".ogg", ".webm", ".wav"},
                       "file": {".pdf", ".txt", ".zip", ".docx", ".xlsx"}}
            if kind not in allowed or suffix not in allowed[kind] or upload.size > 10 * 1024 * 1024:
                return Response({"detail": "Unsupported attachment or file larger than 10 MB."}, status=400)
            if kind == "image":
                try:
                    with Image.open(upload) as picture:
                        if picture.format not in {"JPEG", "PNG", "WEBP"} or picture.width * picture.height > 25_000_000:
                            raise ValueError("Unsupported image")
                        picture.verify()
                    upload.seek(0)
                except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
                    return Response({"detail": "The attachment is not a valid image."}, status=400)
        elif kind != "text":
            return Response({"detail": "Choose an attachment."}, status=400)
        message = Message.objects.create(conversation=conversation, sender=request.user, body=body, kind=kind,
                                         attachment=upload, attachment_name=Path(upload.name).name[:255] if upload else "")
        conversation.save(update_fields=("updated_at",))
        return Response(message_payload(message), status=201)


class ConversationReadView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, conversation_id):
        conversation = get_object_or_404(accessible_conversations(request.user), pk=conversation_id)
        count = conversation.messages.filter(read_at__isnull=True).exclude(sender=request.user).update(read_at=timezone.now())
        return Response({"marked_read": count})


class MessageAttachmentView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request, message_id):
        message = get_object_or_404(Message.objects.select_related("conversation"), pk=message_id)
        conversation = message.conversation
        if request.user.pk not in (conversation.user_low_id, conversation.user_high_id) or not message.attachment:
            return Response({"detail": "Attachment unavailable."}, status=404)
        if not visible_messages(conversation, request.user).filter(pk=message.pk).exists():
            return Response({"detail": "Attachment unavailable."}, status=404)
        response = FileResponse(message.attachment.open("rb"), as_attachment=message.kind == "file", filename=message.attachment_name)
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response


class ConversationReportView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, conversation_id):
        conversation = get_object_or_404(accessible_conversations(request.user), pk=conversation_id)
        reason = str(request.data.get("reason", "")).strip()
        if not 10 <= len(reason) <= 1000:
            return Response({"detail": "Describe the issue in 10–1000 characters."}, status=400)
        ConversationReport.objects.create(conversation=conversation, reporter=request.user, reason=reason)
        return Response({"detail": "Report submitted for moderation."}, status=201)
