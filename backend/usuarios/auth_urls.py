from django.urls import path

from usuarios import views


urlpatterns = [
    path("google/", views.login_google, name="login_google"),
    path(
        "google/calendario/",
        views.conectar_google_calendar,
        name="conectar_google_calendar",
    ),
    path("sair/", views.sair, name="sair_autenticacao"),
]
