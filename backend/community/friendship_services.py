"""Atomic domain operations for the canonical friendship relation."""

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from community.models import Friendship
from users.social_services import has_block_between


User = get_user_model()


def canonical_user_ids(first_user, second_user) -> tuple[int, int]:
    """Return one stable pair order suitable for the database constraint."""

    return tuple(sorted((first_user.pk, second_user.pk)))


def accepted_friend_ids(user):
    """Return accepted friend IDs without creating a second social graph."""

    relationships = Friendship.objects.filter(
        Q(user_low=user) | Q(user_high=user),
        status=Friendship.Status.ACCEPTED,
    )
    for relationship in relationships.only("user_low_id", "user_high_id"):
        yield (
            relationship.user_high_id
            if relationship.user_low_id == user.pk
            else relationship.user_low_id
        )


def _lock_users(*user_ids: int) -> None:
    """Serialize pair mutations by locking both participant rows in ID order."""

    locked_ids = list(
        User.objects.select_for_update()
        .filter(pk__in=sorted(set(user_ids)), is_active=True)
        .order_by("pk")
        .values_list("pk", flat=True)
    )
    if locked_ids != sorted(set(user_ids)):
        raise ValidationError({"detail": "The selected user is unavailable."})


@transaction.atomic
def send_friend_request(*, sender, recipient) -> Friendship:
    if sender.pk == recipient.pk:
        raise ValidationError({"detail": "You cannot send a friend request to yourself."})

    low_id, high_id = canonical_user_ids(sender, recipient)
    _lock_users(low_id, high_id)
    if has_block_between(sender, recipient):
        raise PermissionDenied("This user is unavailable.")
    existing = Friendship.objects.select_for_update().filter(
        user_low_id=low_id,
        user_high_id=high_id,
    ).first()
    if existing:
        if existing.status == Friendship.Status.ACCEPTED:
            message = "You are already friends."
        elif existing.requested_by_id == sender.pk:
            message = "A friend request is already pending."
        else:
            message = "This user has already sent you a friend request."
        raise ValidationError({"detail": message})

    try:
        with transaction.atomic():
            return Friendship.objects.create(
                user_low_id=low_id,
                user_high_id=high_id,
                requested_by=sender,
                status=Friendship.Status.PENDING,
            )
    except IntegrityError as error:
        raise ValidationError(
            {"detail": "A relationship with this user already exists."}
        ) from error


def _locked_relationship_for_participant(*, relationship_id: int, user) -> Friendship:
    relationship = get_object_or_404(
        Friendship.objects.select_for_update().select_related(
            "user_low",
            "user_high",
            "requested_by",
        ),
        pk=relationship_id,
    )
    if not relationship.includes(user):
        raise PermissionDenied("You cannot manage another user's relationship.")
    return relationship


@transaction.atomic
def accept_friend_request(*, relationship_id: int, recipient) -> Friendship:
    relationship = _locked_relationship_for_participant(
        relationship_id=relationship_id,
        user=recipient,
    )
    if relationship.status != Friendship.Status.PENDING:
        raise ValidationError({"detail": "This request is no longer pending."})
    if relationship.requested_by_id == recipient.pk:
        raise PermissionDenied("Only the recipient can accept this friend request.")

    relationship.status = Friendship.Status.ACCEPTED
    relationship.responded_at = timezone.now()
    relationship.save(update_fields=("status", "responded_at", "updated_at"))
    return relationship


@transaction.atomic
def reject_friend_request(*, relationship_id: int, recipient) -> None:
    relationship = _locked_relationship_for_participant(
        relationship_id=relationship_id,
        user=recipient,
    )
    if relationship.status != Friendship.Status.PENDING:
        raise ValidationError({"detail": "This request is no longer pending."})
    if relationship.requested_by_id == recipient.pk:
        raise PermissionDenied("Only the recipient can reject this friend request.")
    from users.signals import notify
    notify(relationship.requested_by, "friend_rejected", "Friend request declined", f"{recipient.username} declined your request.", "/friends")
    relationship.delete()


@transaction.atomic
def cancel_friend_request(*, relationship_id: int, sender) -> None:
    relationship = _locked_relationship_for_participant(
        relationship_id=relationship_id,
        user=sender,
    )
    if relationship.status != Friendship.Status.PENDING:
        raise ValidationError({"detail": "This request is no longer pending."})
    if relationship.requested_by_id != sender.pk:
        raise PermissionDenied("Only the sender can cancel this friend request.")
    relationship.delete()


@transaction.atomic
def remove_friendship(*, user, other_user) -> None:
    if user.pk == other_user.pk:
        raise ValidationError({"detail": "You cannot remove yourself from friends."})
    low_id, high_id = canonical_user_ids(user, other_user)
    _lock_users(low_id, high_id)
    relationship = get_object_or_404(
        Friendship.objects.select_for_update(),
        user_low_id=low_id,
        user_high_id=high_id,
        status=Friendship.Status.ACCEPTED,
    )
    relationship.delete()
