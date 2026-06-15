from django.contrib import admin

from peticoes.models import Peticao


@admin.register(Peticao)
class PeticaoAdmin(admin.ModelAdmin):
    list_display = (
        "cliente",
        "processo",
        "tipo",
        "adverso",
        "responsavel_acao",
        "area_juridica",
        "status",
    )
    search_fields = (
        "cliente__nome",
        "processo__numero_processo",
        "tipo",
        "adverso",
        "responsavel_acao",
        "processo__area_juridica",
    )
    list_filter = ("tipo", "status", "processo__area_juridica", "responsavel_acao")

    @admin.display(description="Área jurídica", ordering="processo__area_juridica")
    def area_juridica(self, obj):
        return obj.processo.area_juridica if obj.processo_id else ""
