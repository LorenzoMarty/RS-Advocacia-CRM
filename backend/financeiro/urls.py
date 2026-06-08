from django.urls import path

from financeiro import views


urlpatterns = [
    path("api/financeiro/", views.listar_lancamentos, name="listar_lancamentos"),
    path("api/financeiro/categorias/", views.categorias_financeiro, name="categorias_financeiro"),
    path("api/financeiro/dashboard/", views.dashboard_financeiro, name="dashboard_financeiro"),
    path("api/financeiro/criar/", views.criar_lancamento, name="criar_lancamento"),
    path("api/financeiro/<int:lancamento_id>/", views.detalhes_lancamento, name="detalhes_lancamento"),
    path("api/financeiro/<int:lancamento_id>/editar/", views.editar_lancamento, name="editar_lancamento"),
    path("api/financeiro/<int:lancamento_id>/excluir/", views.excluir_lancamento, name="excluir_lancamento"),
    path("api/financeiro/<int:lancamento_id>/marcar-pago/", views.marcar_pago, name="marcar_pago"),
    path("api/financeiro/<int:lancamento_id>/cancelar/", views.cancelar_lancamento, name="cancelar_lancamento"),
]
