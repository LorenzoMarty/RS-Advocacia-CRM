from django.urls import path

from peticoes import views

urlpatterns = [
    path("api/peticoes/", views.listar_peticoes, name="listar_peticoes"),
    path("api/peticoes/criar/", views.criar_peticao, name="criar_peticao"),
    path(
        "api/peticoes/<int:peticao_id>/",
        views.detalhes_peticao,
        name="detalhes_peticao",
    ),
    path(
        "api/peticoes/<int:peticao_id>/editar/",
        views.editar_peticao,
        name="editar_peticao",
    ),
    path(
        "api/peticoes/<int:peticao_id>/documento/",
        views.documento_peticao,
        name="documento_peticao",
    ),
    path(
        "api/peticoes/<int:peticao_id>/excluir/",
        views.excluir_peticao,
        name="excluir_peticao",
    ),
]
