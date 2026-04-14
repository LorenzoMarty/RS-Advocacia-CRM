from django.urls import path

from agenda import views


urlpatterns = [
    path("api/eventos/", views.listar_eventos, name="listar_eventos"),
    path("api/eventos/criar/", views.criar_evento, name="criar_evento"),
    path("api/eventos/calendario/", views.eventos_calendario, name="eventos_calendario"),
    path("api/eventos/<int:evento_id>/", views.detalhes_evento, name="detalhes_evento"),
    path("api/eventos/<int:evento_id>/editar/", views.editar_evento, name="editar_evento"),
    path("api/eventos/<int:evento_id>/excluir/", views.excluir_evento, name="excluir_evento"),
]
