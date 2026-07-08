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
    path(
        "api/clientes/<int:cliente_id>/drive/listar/",
        views.listar_drive_view,
        name="listar_drive",
    ),
    path(
        "api/clientes/<int:cliente_id>/drive/pastas/",
        views.criar_pasta_view,
        name="criar_pasta_drive",
    ),
    path(
        "api/clientes/<int:cliente_id>/drive/pastas/<str:folder_id>/",
        views.gerenciar_pasta_view,
        name="gerenciar_pasta_drive",
    ),
    path(
        "api/clientes/<int:cliente_id>/drive/upload/",
        views.upload_drive_view,
        name="upload_drive",
    ),
    path(
        "api/clientes/<int:cliente_id>/drive/importar/escanear/",
        views.escanear_importacao_view,
        name="escanear_importacao",
    ),
    path(
        "api/clientes/<int:cliente_id>/drive/importar/confirmar/",
        views.confirmar_importacao_view,
        name="confirmar_importacao",
    ),
]
