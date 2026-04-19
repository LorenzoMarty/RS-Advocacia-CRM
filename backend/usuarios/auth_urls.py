from django.urls import path

from usuarios import views


urlpatterns = [
    path("google/", views.google_login, name="google_login"),
    path("logout/", views.logout, name="auth_logout"),
]
