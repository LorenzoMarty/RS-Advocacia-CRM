from django.contrib import admin

from agenda.models import Evento

# Register your models here.
@admin.register(Evento)
class EventoAdmin(admin.ModelAdmin):
    list_display = ("titulo", "tipo_evento", "data_inicio", "responsavel", "status")
    search_fields = ("titulo", "cliente__nome", "processo__numero_processo")
    list_filter = ("tipo_evento", "status", "responsavel")