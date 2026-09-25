from django.db.models.signals import post_save, pre_save, post_delete
from django.db.models import Q
from django.dispatch import receiver
from decimal import Decimal

from chat.models import Message, ConversationPreference
from community.models import Friendship, PostComment, PostReaction, UserFollow
from .models import Notification, User
from django.db import transaction
from games.models import Game
from community.models import CommunityPost


def notify(user, key, title, body, path):
    if user.notification_preferences.get(key, True):
        Notification.objects.create(user=user, kind=key, title=title, body=body[:300], target_path=path)


def bulk_notify(users, key_for_user, title, body, path):
    """Create a large notification fan-out in bounded database batches."""

    batch = []
    for user in users.iterator(chunk_size=500):
        key = key_for_user(user)
        if not user.notification_preferences.get(key, True):
            continue
        batch.append(
            Notification(
                user=user,
                kind=key,
                title=title,
                body=body[:300],
                target_path=path,
            )
        )
        if len(batch) == 500:
            Notification.objects.bulk_create(batch, batch_size=500)
            batch.clear()
    if batch:
        Notification.objects.bulk_create(batch, batch_size=500)


@receiver(post_save, sender=Message)
def message_notification(sender, instance, created, **kwargs):
    if created:
        recipient = instance.conversation.other(instance.sender)
        if ConversationPreference.objects.filter(conversation=instance.conversation, user=recipient, muted=True).exists():
            return
        notify(recipient, "message", f"Message from {instance.sender.username}", instance.body or instance.attachment_name, f"/chat?conversation={instance.conversation_id}")


@receiver(post_save, sender=Friendship)
def friendship_notification(sender, instance, created, **kwargs):
    if created:
        recipient = instance.other_user(instance.requested_by)
        notify(recipient, "friend_request", "New friend request", f"{instance.requested_by.username} sent you a request.", "/friends?tab=requests")
    elif instance.status == Friendship.Status.ACCEPTED and getattr(instance, "_previous_status", None) != Friendship.Status.ACCEPTED:
        notify(instance.requested_by, "friend_accepted", "Friend request accepted", "You have a new friend.", "/friends")


@receiver(pre_save, sender=Friendship)
def friendship_previous_status(sender, instance, **kwargs):
    instance._previous_status = Friendship.objects.filter(pk=instance.pk).values_list("status", flat=True).first() if instance.pk else None


@receiver(post_save, sender=PostComment)
def comment_notification(sender, instance, created, **kwargs):
    if created and instance.author_id != instance.post.author_id:
        notify(instance.post.author, "comment", "New comment", f"{instance.author.username} commented on your post.", f"/community/posts/{instance.post_id}#comments")


@receiver(post_save, sender=PostReaction)
def reaction_notification(sender, instance, created, **kwargs):
    if created and instance.user_id != instance.post.author_id:
        notify(instance.post.author, "reaction", "New reaction", f"{instance.user.username} liked your post.", f"/community/posts/{instance.post_id}")


@receiver(post_save, sender=UserFollow)
def follow_notification(sender, instance, created, **kwargs):
    if created:
        notify(instance.following, "follow", "New follower", f"{instance.follower.username} followed you.", f"/users/{instance.follower_id}")


@receiver(post_delete, sender=User)
def remove_profile_files(sender, instance, **kwargs):
    for field in (instance.avatar, instance.cover):
        if field:
            transaction.on_commit(lambda storage=field.storage, name=field.name: storage.delete(name))


@receiver(pre_save, sender=User)
def previous_profile_files(sender, instance, **kwargs):
    update_fields = kwargs.get("update_fields")
    if update_fields is not None and not {"avatar", "cover"}.intersection(update_fields):
        instance._previous_profile_files = ()
        return
    if not instance.pk:
        instance._previous_profile_files = ()
        return
    previous = User.objects.filter(pk=instance.pk).only("avatar", "cover").first()
    if previous is None:
        instance._previous_profile_files = ()
        return
    instance._previous_profile_files = tuple(
        (field.storage, field.name)
        for field in (previous.avatar, previous.cover)
        if field
    )


def delete_unreferenced_profile_file(storage, name, user_id):
    still_used = User.objects.exclude(pk=user_id).filter(
        Q(avatar=name) | Q(cover=name)
    ).exists()
    if not still_used:
        storage.delete(name)


@receiver(post_save, sender=User)
def remove_replaced_profile_files(sender, instance, **kwargs):
    current_names = {
        field.name
        for field in (instance.avatar, instance.cover)
        if field
    }
    for storage, name in getattr(instance, "_previous_profile_files", ()):
        if name and name not in current_names:
            transaction.on_commit(
                lambda storage=storage, name=name, user_id=instance.pk:
                delete_unreferenced_profile_file(storage, name, user_id)
            )


@receiver(post_delete, sender=Message)
def remove_message_file(sender, instance, **kwargs):
    if instance.attachment:
        storage, name = instance.attachment.storage, instance.attachment.name
        transaction.on_commit(lambda: storage.delete(name))


@receiver(pre_save, sender=Game)
def previous_game_price(sender, instance, **kwargs):
    instance._previous_price = Game.objects.filter(pk=instance.pk).values_list("price", flat=True).first() if instance.pk else None


@receiver(post_save, sender=Game)
def price_drop_notifications(sender, instance, created, **kwargs):
    previous = getattr(instance, "_previous_price", None)
    fields = kwargs.get("update_fields")
    if kwargs.get("raw") or (fields is not None and "price" not in fields):
        return
    price = Decimal(str(instance.price))
    if created or previous is None or price >= previous:
        return
    wished = set(instance.wishlist_items.values_list("user_id", flat=True))
    bulk_notify(
        User.objects.filter(is_active=True),
        lambda user: "wishlist_sale" if user.pk in wished else "store_sale",
        f"Price drop: {instance.title}"[:160],
        f"Now ${price:.2f} (previously ${previous:.2f}).",
        f"/games/{instance.pk}",
    )


@receiver(pre_save, sender=CommunityPost)
def previous_news_visibility(sender, instance, **kwargs):
    instance._was_published_news = bool(instance.pk and CommunityPost.objects.filter(pk=instance.pk, kind="news", is_published=True).exists())


@receiver(post_save, sender=CommunityPost)
def news_notifications(sender, instance, created, **kwargs):
    if instance.kind != "news" or not instance.is_published or getattr(instance, "_was_published_news", False) or not instance.author.is_staff:
        return
    recipients = User.objects.filter(is_active=True).exclude(pk=instance.author_id)
    if instance.game_id:
        recipients = recipients.filter(library_items__game_id=instance.game_id).distinct()
    bulk_notify(
        recipients,
        lambda user: "news",
        instance.title[:160],
        instance.body,
        f"/community/posts/{instance.pk}",
    )
