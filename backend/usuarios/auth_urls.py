from django.urls import path

from usuarios import views


urlpatterns = [
    path("sair/", views.sair, name="sair_autenticacao"),
]
