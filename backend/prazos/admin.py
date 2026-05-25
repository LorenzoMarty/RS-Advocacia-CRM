from django.contrib import admin

from prazos.models import Prazo


@admin.register(Prazo)
class PrazoAdmin(admin.ModelAdmin):
    list_display = ("titulo", "data_limite", "processo", "responsavel", "status")
    search_fields = ("titulo", "processo__numero_processo", "processo__cliente__nome")
    list_filter = ("status", "responsavel")
