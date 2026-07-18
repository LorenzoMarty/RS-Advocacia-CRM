from django.urls import path

from auditoria import views

urlpatterns = [
    path("api/auditoria/", views.listar_auditoria, name="listar_auditoria"),
    path("api/auditoria/autores/", views.listar_autores, name="listar_autores"),
    path("api/auditoria/painel/", views.painel_auditoria, name="painel_auditoria"),
    path("api/auditoria/visao-geral/", views.visao_geral, name="visao_geral"),
]
