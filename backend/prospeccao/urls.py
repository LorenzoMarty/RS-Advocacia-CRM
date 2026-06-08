from django.urls import path

from prospeccao import views


urlpatterns = [
    path("api/prospeccao/", views.listar_prospects, name="listar_prospects"),
    path("api/prospeccao/criar/", views.criar_prospect, name="criar_prospect"),
    path("api/prospeccao/<int:prospect_id>/", views.detalhes_prospect, name="detalhes_prospect"),
    path("api/prospeccao/<int:prospect_id>/editar/", views.editar_prospect, name="editar_prospect"),
    path("api/prospeccao/<int:prospect_id>/excluir/", views.excluir_prospect, name="excluir_prospect"),
    path("api/prospeccao/<int:prospect_id>/interacoes/", views.listar_interacoes, name="listar_interacoes"),
    path("api/prospeccao/<int:prospect_id>/interacoes/criar/", views.criar_interacao, name="criar_interacao"),
    path("api/prospeccao/<int:prospect_id>/converter/", views.converter_prospect, name="converter_prospect"),
]
