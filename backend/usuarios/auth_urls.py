from django.urls import path

from usuarios import views


urlpatterns = [
    path("login/", views.login, name="auth_login"),
    path("google/", views.google_login, name="google_login"),
    path("google/config/", views.google_login_config, name="google_login_config"),
    path("logout/", views.logout, name="auth_logout"),
]
