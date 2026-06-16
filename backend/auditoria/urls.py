from django.urls import path

from auditoria import views

urlpatterns = [
    path("api/auditoria/", views.listar_auditoria, name="listar_auditoria"),
]
