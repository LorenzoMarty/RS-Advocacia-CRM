from django.urls import path

from meetings import views


urlpatterns = [
    path("api/reunioes/", views.listar_reunioes, name="listar_reunioes"),
    path("api/reunioes/criar/", views.criar_reuniao, name="criar_reuniao"),
    path("api/reunioes/<int:reuniao_id>/", views.detalhes_reuniao, name="detalhes_reuniao"),
    path(
        "api/reunioes/<int:reuniao_id>/gravacoes/",
        views.enviar_gravacao,
        name="enviar_gravacao",
    ),
    path(
        "api/reunioes/gravacoes/<int:gravacao_id>/",
        views.detalhes_gravacao,
        name="detalhes_gravacao",
    ),
]

