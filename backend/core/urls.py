from django.urls import path

from core import views


urlpatterns = [
    path("api/dashboard/", views.dashboard, name="dashboard"),
    path("api/bootstrap/", views.bootstrap, name="bootstrap"),
    path("api/csrf/", views.csrf_token, name="csrf_token"),
]
