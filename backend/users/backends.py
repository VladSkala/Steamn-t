from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend


class EmailBackend(ModelBackend):
    """Authenticate API users by their unique email address."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        email = kwargs.get("email")
        if email is None or password is None:
            return None

        user_model = get_user_model()

        try:
            user = user_model._default_manager.get(email__iexact=email)
        except user_model.DoesNotExist:
            # Keep the missing-user path close to a real password check in cost.
            user_model().set_password(password)
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user

        return None
