from django.urls import path

from core import health, views

urlpatterns = [
    path("api/painel/", views.painel, name="painel"),
    path("api/inicializacao/", views.inicializacao, name="inicializacao"),
    path("api/csrf/", views.csrf_token, name="csrf_token"),
    path("health/", health.health, name="health"),
    path("ready/", health.ready, name="ready"),
]
