from django.contrib import admin
from django.urls import include, path


urlpatterns = [
    path("api/auth/", include("usuarios.auth_urls")),
    path("", include("core.urls")),
    path("admin/", admin.site.urls),
    path("", include("agenda.urls")),
    path("", include("processos.urls")),
    path("", include("clientes.urls")),
    path("", include("usuarios.urls")),
]
