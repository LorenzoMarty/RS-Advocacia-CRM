from django.urls import path

from agenda.views import criar_evento, detalhes_evento, editar_evento, excluir_evento, listar_eventos

urlpatterns = [
    path('agenda/', listar_eventos, name='listar_eventos'),
    path('agenda/criar/', criar_evento, name='criar_evento'),
    path('agenda/<int:evento_id>/editar/', editar_evento, name='editar_evento'),
    path('agenda/<int:evento_id>/excluir/', excluir_evento, name='excluir_evento'),
    path('agenda/<int:evento_id>/', detalhes_evento, name='detalhes_evento'),
]
