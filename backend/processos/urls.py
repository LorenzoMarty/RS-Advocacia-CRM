from django.urls import path

from processos import views


urlpatterns = [
    path("api/processos/", views.listar_processos, name="listar_processos"),
    path("api/processos/criar/", views.criar_processo, name="criar_processo"),
    path("api/processos/<int:processo_id>/", views.detalhes_processo, name="detalhes_processo"),
    path("api/processos/<int:processo_id>/editar/", views.editar_processo, name="editar_processo"),
    path("api/processos/<int:processo_id>/excluir/", views.excluir_processo, name="excluir_processo"),
]
