from django.db import migrations, models
from django.db.models import Count
from django.db.models.functions import Lower


def normalize_and_validate_identities(apps, schema_editor):
    User = apps.get_model("users", "User")

    conflicts = []
    for field in ("email", "username"):
        duplicates = list(
            User.objects.annotate(normalized=Lower(field))
            .values("normalized")
            .annotate(total=Count("pk"))
            .filter(total__gt=1)
            .values_list("normalized", flat=True)[:10]
        )
        if duplicates:
            conflicts.append(f"{field}: {', '.join(duplicates)}")

    if conflicts:
        raise RuntimeError(
            "Case-insensitive user identity conflicts must be resolved before "
            f"this migration can continue ({'; '.join(conflicts)})."
        )

    for user in User.objects.exclude(email="").iterator():
        normalized_email = user.email.lower()
        if user.email != normalized_email:
            user.email = normalized_email
            user.save(update_fields=("email",))


class Migration(migrations.Migration):
    dependencies = [("users", "0001_initial")]

    operations = [
        migrations.RunPython(
            normalize_and_validate_identities,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.AddConstraint(
            model_name="user",
            constraint=models.UniqueConstraint(
                Lower("email"),
                name="unique_user_email_ci",
            ),
        ),
        migrations.AddConstraint(
            model_name="user",
            constraint=models.UniqueConstraint(
                Lower("username"),
                name="unique_user_username_ci",
            ),
        ),
    ]
