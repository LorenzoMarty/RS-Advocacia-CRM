from django.urls import path

from ai import views

urlpatterns = [
    path("api/ia/configuracao/", views.configuracao_ia, name="configuracao_ia"),
    path("api/ia/custo/", views.custo_ia, name="custo_ia"),
]
