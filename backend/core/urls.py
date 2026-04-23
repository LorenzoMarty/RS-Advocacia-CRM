from django.urls import path

from core import views


urlpatterns = [
    path("api/painel/", views.painel, name="painel"),
    path("api/inicializacao/", views.inicializacao, name="inicializacao"),
    path("api/csrf/", views.csrf_token, name="csrf_token"),
]
