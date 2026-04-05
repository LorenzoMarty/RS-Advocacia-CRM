from django.urls import path

from usuarios.views import (
    criar_cargo,
    criar_usuario,
    detalhes_cargo,
    detalhes_usuario,
    editar_cargo,
    editar_usuario,
    excluir_cargo,
    excluir_usuario,
    listar_cargos,
    listar_usuarios,
    login,
    logout,
)

urlpatterns = [
    path('usuarios/', listar_usuarios, name='listar_usuarios'),
    path('usuarios/criar/', criar_usuario, name='criar_usuario'),
    path('usuarios/<int:usuario_id>/editar/', editar_usuario, name='editar_usuario'),
    path('usuarios/<int:usuario_id>/excluir/', excluir_usuario, name='excluir_usuario'),
    path('usuarios/<int:usuario_id>/', detalhes_usuario, name='detalhes_usuario'),
    path('cargos/', listar_cargos, name='listar_cargos'),
    path('cargos/criar/', criar_cargo, name='criar_cargo'),
    path('cargos/<int:cargo_id>/editar/', editar_cargo, name='editar_cargo'),
    path('cargos/<int:cargo_id>/excluir/', excluir_cargo, name='excluir_cargo'),
    path('cargos/<int:cargo_id>/', detalhes_cargo, name='detalhes_cargo'),
    path('login/', login, name='login'),
    path('logout/', logout, name='logout'),
]
