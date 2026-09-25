from django.urls import path
from .account_views import PasswordResetRequestView, PasswordResetConfirmView, BlockListView, BlockView, PublicProfileContentView

from .views import CurrentUserProfileView, LoginView, RefreshView, RegisterView, PublicProfileView, PublicProfileSocialView, PasswordChangeView, WalletView, DeleteAccountView, NotificationView, NotificationReadView, NotificationReadAllView


app_name = "users"

urlpatterns = [
    path("auth/password-reset/", PasswordResetRequestView.as_view()),
    path("auth/password-reset/confirm/", PasswordResetConfirmView.as_view()),
    path("blocks/", BlockListView.as_view()),
    path("users/<int:user_id>/content/", PublicProfileContentView.as_view()),
    path("users/<int:user_id>/block/", BlockView.as_view()),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/token/", LoginView.as_view(), name="token"),
    path("auth/token/refresh/", RefreshView.as_view(), name="token-refresh"),
    path("profile/", CurrentUserProfileView.as_view(), name="profile"),
    path("users/<int:user_id>/", PublicProfileView.as_view(), name="public-profile"),
    path("users/<int:user_id>/social/", PublicProfileSocialView.as_view(), name="public-profile-social"),
    path("settings/password/", PasswordChangeView.as_view(), name="password-change"),
    path("settings/wallet/", WalletView.as_view(), name="wallet"),
    path("settings/delete-account/", DeleteAccountView.as_view(), name="delete-account"),
    path("notifications/", NotificationView.as_view(), name="notifications"),
    path("notifications/<int:notification_id>/read/", NotificationReadView.as_view(), name="notification-read"),
    path("notifications/read-all/", NotificationReadAllView.as_view(), name="notification-read-all"),
]
