from django.contrib import admin

from .models import RenomeacaoPastaPendente


@admin.register(RenomeacaoPastaPendente)
class RenomeacaoPastaPendenteAdmin(admin.ModelAdmin):
    list_display = ("tipo", "objeto_id", "tentativas", "atualizado_em", "ultimo_erro")
    list_filter = ("tipo",)
    readonly_fields = ("criado_em", "atualizado_em")
