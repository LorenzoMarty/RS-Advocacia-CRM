from django.urls import path

from clientes.views import criar_cliente, detalhes_cliente, listar_clientes

urlpatterns = [
    path('clientes/', listar_clientes, name='listar_clientes'),
    path('clientes/criar/', criar_cliente, name='criar_cliente'),
    path('clientes/<int:cliente_id>/', detalhes_cliente, name='detalhes_cliente'),
]