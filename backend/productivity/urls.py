from django.urls import path

from productivity import views


urlpatterns = [
    path("api/produtividade/", views.produtividade, name="produtividade"),
    path("api/produtividade/time-entries/iniciar/", views.iniciar_timer, name="iniciar_timer"),
    path("api/produtividade/time-entries/<int:entry_id>/pausar/", views.pausar_timer, name="pausar_timer"),
    path("api/produtividade/time-entries/<int:entry_id>/retomar/", views.retomar_timer, name="retomar_timer"),
    path("api/produtividade/time-entries/<int:entry_id>/encerrar/", views.encerrar_timer, name="encerrar_timer"),
    path("api/produtividade/metas/", views.listar_metas, name="listar_metas_produtividade"),
    path("api/produtividade/metas/salvar/", views.salvar_metas, name="salvar_metas_produtividade"),
]
