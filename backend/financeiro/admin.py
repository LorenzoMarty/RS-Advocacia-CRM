from django.contrib import admin

from financeiro.models import Lancamento


@admin.register(Lancamento)
class LancamentoAdmin(admin.ModelAdmin):
    list_display = (
        "descricao",
        "tipo",
        "categoria",
        "valor",
        "data_vencimento",
        "status",
    )
    search_fields = ("descricao", "categoria", "cliente_relacionado__nome")
    list_filter = ("tipo", "status", "categoria")
