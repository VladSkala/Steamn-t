"""Shared block, privacy and public identity rules for social features."""
from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import ValidationError
from .models import User, UserBlock


def _id(value):
    return getattr(value, "pk", value)


def has_block_between(a_id, b_id):
    a_id, b_id = _id(a_id), _id(b_id)
    if not a_id or not b_id:
        return False
    return UserBlock.objects.filter(Q(blocker_id=a_id, blocked_id=b_id) | Q(blocker_id=b_id, blocked_id=a_id)).exists()


are_users_blocked = has_block_between


def blocked_user_ids(user):
    user_id = _id(user)
    rows = UserBlock.objects.filter(Q(blocker_id=user_id) | Q(blocked_id=user_id)).values_list("blocker_id", "blocked_id")
    return {other for pair in rows for other in pair if other != user_id}


@transaction.atomic
def block_user(*, blocker, blocked):
    from community.models import Friendship, UserFollow
    if blocker.pk == blocked.pk:
        raise ValidationError({"detail": "You cannot block yourself."})
    list(User.objects.select_for_update().filter(pk__in=sorted([blocker.pk, blocked.pk])).order_by("pk"))
    block, _ = UserBlock.objects.get_or_create(blocker=blocker, blocked=blocked)
    low, high = sorted((blocker.pk, blocked.pk))
    Friendship.objects.filter(user_low_id=low, user_high_id=high).delete()
    UserFollow.objects.filter(Q(follower=blocker, following=blocked) | Q(follower=blocked, following=blocker)).delete()
    return block


def public_identity(user, request=None):
    avatar = user.avatar.url if user.avatar else None
    return {"id": user.pk, "username": user.username, "display_name": user.get_full_name().strip() or user.username, "avatar": request.build_absolute_uri(avatar) if request and avatar else avatar, "is_online": user.is_online, "last_seen_at": user.last_seen_at if user.show_online else None}
