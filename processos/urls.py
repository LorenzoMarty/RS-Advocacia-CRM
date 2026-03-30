from django.urls import path

from processos.views import criar_processo, detalhes_processo, editar_processo, excluir_processo, listar_processos

urlpatterns = [
    path('processos/', listar_processos, name='listar_processos'),
    path('processos/criar/', criar_processo, name='criar_processo'),
    path('processos/<int:processo_id>/editar/', editar_processo, name='editar_processo'),
    path('processos/<int:processo_id>/excluir/', excluir_processo, name='excluir_processo'),
    path('processos/<int:processo_id>/', detalhes_processo, name='detalhes_processo'),
]
