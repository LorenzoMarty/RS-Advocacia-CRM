from django.urls import path

from processos.views import detalhes_processo, listar_processos, criar_processo

urlpatterns = [
    path('processos/', listar_processos, name='listar_processos'),
    path('processos/criar/', criar_processo, name='criar_processo'),
    path('processos/<int:processo_id>/', detalhes_processo, name='detalhes_processo'),
]