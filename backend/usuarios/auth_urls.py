from django.urls import path

from usuarios import views


urlpatterns = [
    path("google/", views.login_google, name="login_google"),
    path("sair/", views.sair, name="sair_autenticacao"),
]
