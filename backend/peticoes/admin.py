from django.contrib import admin

from peticoes.models import Peticao


@admin.register(Peticao)
class PeticaoAdmin(admin.ModelAdmin):
    list_display = ("cliente", "tipo", "adverso", "responsavel_acao", "area_juridica", "status")
    search_fields = ("cliente__nome", "tipo", "adverso", "responsavel_acao", "area_juridica")
    list_filter = ("tipo", "status", "area_juridica", "responsavel_acao")
