from django.urls import path

from documentos import views

urlpatterns = [
    path(
        "api/clientes/<int:cliente_id>/documentos/",
        views.listar_documentos_view,
        name="listar_documentos",
    ),
    path(
        "api/clientes/<int:cliente_id>/documentos/upload/",
        views.upload_documento_view,
        name="upload_documento",
    ),
    path(
        "api/clientes/<int:cliente_id>/documentos/<int:doc_id>/download/",
        views.download_documento_view,
        name="download_documento",
    ),
    path(
        "api/clientes/<int:cliente_id>/drive/estrutura/",
        views.estrutura_drive_view,
        name="estrutura_drive",
    ),
]
