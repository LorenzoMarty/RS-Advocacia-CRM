from django.urls import path

from clientes import views


urlpatterns = [
    path("api/clientes/", views.listar_clientes, name="listar_clientes"),
    path("api/clientes/criar/", views.criar_cliente, name="criar_cliente"),
    path("api/clientes/<int:cliente_id>/", views.detalhes_cliente, name="detalhes_cliente"),
    path("api/clientes/<int:cliente_id>/editar/", views.editar_cliente, name="editar_cliente"),
    path("api/clientes/<int:cliente_id>/excluir/", views.excluir_cliente, name="excluir_cliente"),
]
