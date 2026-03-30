from django.urls import path

from agenda.views import detalhes_evento, listar_eventos, criar_evento

urlpatterns = [
    path('agenda/', listar_eventos, name='listar_eventos'),
    path('agenda/criar/', criar_evento, name='criar_evento'),
    path('agenda/<int:evento_id>/', detalhes_evento, name='detalhes_evento'),
]