from django.urls import path

from .views import CurrentUserProfileView, LoginView, RefreshView, RegisterView


app_name = "users"

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/token/", LoginView.as_view(), name="token"),
    path("auth/token/refresh/", RefreshView.as_view(), name="token-refresh"),
    path("profile/", CurrentUserProfileView.as_view(), name="profile"),
]
