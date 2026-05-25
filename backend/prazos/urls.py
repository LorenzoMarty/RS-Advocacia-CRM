from django.urls import path

from prazos import views


urlpatterns = [
    path("api/prazos/", views.listar_prazos, name="listar_prazos"),
    path("api/prazos/criar/", views.criar_prazo, name="criar_prazo"),
    path("api/prazos/<int:prazo_id>/", views.detalhes_prazo, name="detalhes_prazo"),
    path("api/prazos/<int:prazo_id>/timer/", views.atualizar_timer_prazo, name="atualizar_timer_prazo"),
    path("api/prazos/<int:prazo_id>/editar/", views.editar_prazo, name="editar_prazo"),
    path("api/prazos/<int:prazo_id>/excluir/", views.excluir_prazo, name="excluir_prazo"),
]
