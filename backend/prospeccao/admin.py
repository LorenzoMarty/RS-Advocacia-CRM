from django.contrib import admin

from prospeccao.models import InteracaoProspect, Prospect


@admin.register(Prospect)
class ProspectAdmin(admin.ModelAdmin):
    list_display = (
        "nome",
        "status_prospeccao",
        "prioridade",
        "responsavel_interno",
        "data_criacao",
    )
    search_fields = ("nome", "email", "telefone", "tipo_demanda_juridica")
    list_filter = ("status_prospeccao", "prioridade", "origem_contato")


@admin.register(InteracaoProspect)
class InteracaoProspectAdmin(admin.ModelAdmin):
    list_display = ("prospect", "tipo", "data", "usuario")
    search_fields = ("prospect__nome", "descricao")
    list_filter = ("tipo",)
