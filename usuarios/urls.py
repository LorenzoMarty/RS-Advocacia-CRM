from django.urls import path

from usuarios.views import criar_usuario, detalhes_usuario, editar_usuario, excluir_usuario, listar_usuarios

urlpatterns = [
    path('usuarios/', listar_usuarios, name='listar_usuarios'),
    path('usuarios/criar/', criar_usuario, name='criar_usuario'),
    path('usuarios/<int:usuario_id>/editar/', editar_usuario, name='editar_usuario'),
    path('usuarios/<int:usuario_id>/excluir/', excluir_usuario, name='excluir_usuario'),
    path('usuarios/<int:usuario_id>/', detalhes_usuario, name='detalhes_usuario'),
]
