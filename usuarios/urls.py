from django.urls import path

from usuarios.views import criar_usuario, detalhes_usuario, listar_usuarios

urlpatterns = [
    path('usuarios/', listar_usuarios, name='listar_usuarios'),
    path('usuarios/criar/', criar_usuario, name='criar_usuario'),
    path('usuarios/<int:usuario_id>/', detalhes_usuario, name='detalhes_usuario'),
]