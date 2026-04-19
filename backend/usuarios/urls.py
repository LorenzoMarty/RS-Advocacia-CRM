from django.urls import path

from usuarios import views


urlpatterns = [
    path("api/usuarios/", views.listar_usuarios, name="listar_usuarios"),
    path("api/usuarios/atual/", views.current_usuario, name="current_usuario"),
    path("api/usuarios/<int:usuario_id>/", views.detalhes_usuario, name="detalhes_usuario"),
    path("api/usuarios/<int:usuario_id>/editar/", views.editar_usuario, name="editar_usuario"),
    path("api/usuarios/<int:usuario_id>/excluir/", views.excluir_usuario, name="excluir_usuario"),
    path("api/cargos/", views.listar_cargos, name="listar_cargos"),
    path("api/cargos/criar/", views.criar_cargo, name="criar_cargo"),
    path("api/cargos/<int:cargo_id>/", views.detalhes_cargo, name="detalhes_cargo"),
    path("api/cargos/<int:cargo_id>/editar/", views.editar_cargo, name="editar_cargo"),
    path("api/cargos/<int:cargo_id>/excluir/", views.excluir_cargo, name="excluir_cargo"),
]
