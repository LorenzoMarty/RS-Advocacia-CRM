from django.urls import path

from . import views

urlpatterns = [
    path("api/notificacoes/", views.listar_notificacoes),
    path("api/notificacoes/<int:notificacao_id>/ler/", views.marcar_lida),
    path("api/notificacoes/ler-todas/", views.marcar_todas_lidas),
]
