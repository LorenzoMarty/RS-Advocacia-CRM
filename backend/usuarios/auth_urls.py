from django.urls import path

from usuarios import views


urlpatterns = [
    path("google/", views.login_google, name="login_google"),
    path("google/retorno/", views.retorno_google, name="retorno_google"),
    path("sair/", views.sair, name="sair_autenticacao"),
]
