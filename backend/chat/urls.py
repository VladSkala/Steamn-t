from django.urls import path
from .views import ConversationListView, ConversationDetailView, MessageListView, ConversationReadView, MessageAttachmentView, ConversationReportView

urlpatterns = [
    path("chat/conversations/", ConversationListView.as_view()),
    path("chat/conversations/<int:conversation_id>/", ConversationDetailView.as_view()),
    path("chat/conversations/<int:conversation_id>/messages/", MessageListView.as_view()),
    path("chat/conversations/<int:conversation_id>/read/", ConversationReadView.as_view()),
    path("chat/conversations/<int:conversation_id>/report/", ConversationReportView.as_view()),
    path("chat/messages/<int:message_id>/attachment/", MessageAttachmentView.as_view()),
]
