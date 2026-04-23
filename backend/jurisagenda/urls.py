from django.contrib import admin
from django.urls import include, path

from usuarios import views as usuarios_views


urlpatterns = [
    path(
        "api/auth/google/callback/",
        usuarios_views.retorno_google,
        name="google_callback",
    ),
    path("api/autenticacao/", include("usuarios.auth_urls")),
    path("", include("core.urls")),
    path("admin/", admin.site.urls),
    path("", include("agenda.urls")),
    path("", include("processos.urls")),
    path("", include("clientes.urls")),
    path("", include("usuarios.urls")),
]
