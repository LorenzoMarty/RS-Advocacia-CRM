from django.urls import path

from . import views

urlpatterns = [
    path("api/opcoes/<str:campo>/", views.listar_opcoes, name="listar_opcoes"),
    path("api/opcoes/<str:campo>/criar/", views.criar_opcao, name="criar_opcao"),
    path(
        "api/opcoes/<str:campo>/<int:opcao_id>/excluir/",
        views.apagar_opcao,
        name="apagar_opcao",
    ),
]
