from django.urls import path

from usuarios import views


urlpatterns = [
    path("google/", views.google_login, name="google_login"),
    path("google/callback/", views.google_callback, name="google_callback"),
    path("logout/", views.logout, name="auth_logout"),
]
