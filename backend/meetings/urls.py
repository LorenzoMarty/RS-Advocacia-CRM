from django.urls import path

from meetings import views

urlpatterns = [
    path("api/reunioes/", views.listar_reunioes, name="listar_reunioes"),
    path("api/reunioes/criar/", views.criar_reuniao, name="criar_reuniao"),
    path(
        "api/reunioes/<int:reuniao_id>/",
        views.detalhes_reuniao,
        name="detalhes_reuniao",
    ),
    path(
        "api/reunioes/<int:reuniao_id>/editar/",
        views.editar_reuniao,
        name="editar_reuniao",
    ),
    path(
        "api/reunioes/<int:reuniao_id>/excluir/",
        views.excluir_reuniao,
        name="excluir_reuniao",
    ),
    path(
        "api/reunioes/<int:reuniao_id>/gravacoes/",
        views.enviar_gravacao,
        name="enviar_gravacao",
    ),
    path(
        "api/reunioes/<int:reuniao_id>/gravacoes/sessao-upload/",
        views.criar_sessao_upload_gravacao,
        name="criar_sessao_upload_gravacao",
    ),
    path(
        "api/reunioes/<int:reuniao_id>/gravacoes/confirmar/",
        views.confirmar_gravacao,
        name="confirmar_gravacao",
    ),
    path(
        "api/reunioes/gravacoes/<int:gravacao_id>/",
        views.detalhes_gravacao,
        name="detalhes_gravacao",
    ),
    path(
        "api/reunioes/gravacoes/<int:gravacao_id>/editar/",
        views.editar_gravacao,
        name="editar_gravacao",
    ),
    path(
        "api/reunioes/gravacoes/<int:gravacao_id>/excluir/",
        views.excluir_gravacao,
        name="excluir_gravacao",
    ),
]
