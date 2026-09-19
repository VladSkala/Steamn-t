from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from chat.models import Conversation, Message
from users.models import Notification, UserBlock


class ChatJourneyTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.alice = User.objects.create_user(username="alice_chat", email="alice_chat@example.test", password="StrongPass123!")
        self.bob = User.objects.create_user(username="bob_chat", email="bob_chat@example.test", password="StrongPass123!")
        self.stranger = User.objects.create_user(username="stranger_chat", email="stranger_chat@example.test", password="StrongPass123!")
        self.client = APIClient()
        self.client.force_authenticate(self.alice)

    def test_text_unread_read_and_participant_permissions(self):
        started = self.client.post("/api/chat/conversations/", {"user_id": self.bob.pk}, format="json")
        self.assertEqual(started.status_code, 200)
        conversation_id = started.data["id"]
        self.assertEqual(self.client.post("/api/chat/conversations/", {"user_id": self.bob.pk}, format="json").data["id"], conversation_id)
        sent = self.client.post(f"/api/chat/conversations/{conversation_id}/messages/", {"body": "Hello Bob"}, format="json")
        self.assertEqual(sent.status_code, 201)
        self.assertEqual(Message.objects.count(), 1)
        self.assertEqual(Notification.objects.filter(user=self.bob, kind="message").count(), 1)
        self.client.force_authenticate(self.bob)
        self.assertEqual(self.client.get("/api/chat/conversations/").data["items"][0]["unread_count"], 1)
        self.assertEqual(self.client.post(f"/api/chat/conversations/{conversation_id}/read/").data["marked_read"], 1)
        self.assertEqual(self.client.post(f"/api/chat/conversations/{conversation_id}/read/").data["marked_read"], 0)
        self.client.force_authenticate(self.stranger)
        self.assertEqual(self.client.get(f"/api/chat/conversations/{conversation_id}/messages/").status_code, 404)

    def test_blocked_and_empty_messages_are_rejected(self):
        conversation = Conversation.objects.create(user_low=min((self.alice, self.bob), key=lambda u: u.pk), user_high=max((self.alice, self.bob), key=lambda u: u.pk))
        self.assertEqual(self.client.post(f"/api/chat/conversations/{conversation.pk}/messages/", {"body": " "}, format="json").status_code, 400)
        UserBlock.objects.create(blocker=self.bob, blocked=self.alice)
        self.assertEqual(self.client.post(f"/api/chat/conversations/{conversation.pk}/messages/", {"body": "No"}, format="json").status_code, 403)
        self.assertEqual(Message.objects.count(), 0)

    def test_notification_preferences_suppress_message_alerts(self):
        prefs = self.bob.notification_preferences
        prefs["message"] = False
        self.bob.notification_preferences = prefs
        self.bob.save(update_fields=("notification_preferences",))
        conversation = Conversation.objects.create(user_low=self.alice, user_high=self.bob)
        self.client.post(f"/api/chat/conversations/{conversation.pk}/messages/", {"body": "Quiet"}, format="json")
        self.assertFalse(Notification.objects.filter(user=self.bob).exists())

    def test_existing_conversation_obeys_changed_privacy(self):
        conversation = Conversation.objects.create(user_low=self.alice, user_high=self.bob)
        self.bob.privacy_messages = "nobody"
        self.bob.save(update_fields=("privacy_messages",))
        self.assertEqual(self.client.post(f"/api/chat/conversations/{conversation.pk}/messages/", {"body": "Blocked by privacy"}).status_code, 403)

    def test_mute_clear_and_report_are_participant_scoped(self):
        conversation = Conversation.objects.create(user_low=self.alice, user_high=self.bob)
        url = f"/api/chat/conversations/{conversation.pk}/"
        self.client.force_authenticate(self.bob)
        self.assertEqual(self.client.patch(url, {"muted": True}, format="json").status_code, 200)
        self.client.force_authenticate(self.alice)
        self.client.post(url + "messages/", {"body": "Quiet message"})
        self.assertFalse(Notification.objects.filter(user=self.bob).exists())
        self.client.delete(url)
        self.assertEqual(self.client.get(url + "messages/").data["count"], 0)
        self.client.force_authenticate(self.bob)
        self.assertEqual(self.client.get(url + "messages/").data["count"], 1)
        self.assertEqual(self.client.post(url + "report/", {"reason": "Unwanted repeated contact"}).status_code, 201)
        self.client.force_authenticate(self.stranger)
        self.assertEqual(self.client.delete(url).status_code, 404)
        self.assertEqual(self.client.post(url + "report/", {"reason": "Unwanted repeated contact"}).status_code, 404)

    def test_private_attachment_storage_and_access(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        conversation = Conversation.objects.create(user_low=self.alice, user_high=self.bob)
        upload = SimpleUploadedFile("notes.txt", b"Private text", content_type="text/plain")
        result = self.client.post(f"/api/chat/conversations/{conversation.pk}/messages/", {"kind": "file", "attachment": upload}, format="multipart")
        self.assertEqual(result.status_code, 201)
        message = Message.objects.get(pk=result.data["id"])
        self.addCleanup(message.attachment.delete, save=False)
        with self.assertRaises(ValueError):
            _ = message.attachment.url
        url = f"/api/chat/messages/{message.pk}/attachment/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(b"".join(response.streaming_content), b"Private text")
        self.client.force_authenticate(self.stranger)
        self.assertEqual(self.client.get(url).status_code, 404)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(url).status_code, 401)

    def test_disguised_image_is_rejected(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        conversation = Conversation.objects.create(user_low=self.alice, user_high=self.bob)
        upload = SimpleUploadedFile("fake.png", b"<script>alert(1)</script>", content_type="image/png")
        result = self.client.post(f"/api/chat/conversations/{conversation.pk}/messages/", {"kind": "image", "attachment": upload}, format="multipart")
        self.assertEqual(result.status_code, 400)
