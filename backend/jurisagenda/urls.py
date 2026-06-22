from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("", include("integrations.urls")),
    path("api/autenticacao/", include("usuarios.auth_urls")),
    path("", include("core.urls")),
    path("admin/", admin.site.urls),
    path("", include("agenda.urls")),
    path("", include("prazos.urls")),
    path("", include("peticoes.urls")),
    path("", include("productivity.urls")),
    path("", include("prospeccao.urls")),
    path("", include("financeiro.urls")),
    path("", include("processos.urls")),
    path("", include("auditoria.urls")),
    path("", include("clientes.urls")),
    path("", include("usuarios.urls")),
    path("", include("meetings.urls")),
    path("", include("documentos.urls")),
    path("", include("notificacoes.urls")),
]
