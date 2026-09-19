# Generated for KAN-47 on 2026-09-11

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("community", "0004_gamereview_review_user_updated_idx"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Friendship",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "status",
                    models.CharField(
                        choices=[("pending", "Pending"), ("accepted", "Accepted")],
                        db_index=True,
                        default="pending",
                        max_length=16,
                    ),
                ),
                ("responded_at", models.DateTimeField(blank=True, null=True)),
                (
                    "requested_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="friend_requests_started",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "user_high",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="friendships_as_high",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "user_low",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="friendships_as_low",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-updated_at", "-pk"],
                "indexes": [
                    models.Index(
                        fields=["status", "-updated_at", "-id"],
                        name="friend_status_updated_idx",
                    ),
                ],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("user_low", "user_high"),
                        name="unique_friendship_pair",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(user_low__lt=models.F("user_high")),
                        name="friendship_pair_is_ordered",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(requested_by=models.F("user_low"))
                        | models.Q(requested_by=models.F("user_high")),
                        name="friendship_requester_is_participant",
                    ),
                ],
            },
        ),
    ]
