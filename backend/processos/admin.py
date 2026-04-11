from django.contrib import admin

from processos.models import Processo

# Register your models here.
@admin.register(Processo)
class ProcessoAdmin(admin.ModelAdmin):
    list_display = ("numero_processo", "cliente", "status", "advogado_responsavel")
    search_fields = ("numero_processo", "cliente__nome")
    list_filter = ("status",)