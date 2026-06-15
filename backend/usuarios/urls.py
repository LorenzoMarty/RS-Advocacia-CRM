from django.urls import path

from usuarios import views

urlpatterns = [
    path("api/usuarios/", views.listar_usuarios, name="listar_usuarios"),
    path("api/usuarios/criar/", views.criar_usuario, name="criar_usuario"),
    path("api/usuarios/atual/", views.usuario_atual, name="usuario_atual"),
    path(
        "api/usuarios/<int:usuario_id>/",
        views.detalhes_usuario,
        name="detalhes_usuario",
    ),
    path(
        "api/usuarios/<int:usuario_id>/editar/",
        views.editar_usuario,
        name="editar_usuario",
    ),
    path(
        "api/usuarios/<int:usuario_id>/excluir/",
        views.excluir_usuario,
        name="excluir_usuario",
    ),
]
