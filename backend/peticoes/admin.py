from django.contrib import admin

from peticoes.models import Peticao


@admin.register(Peticao)
class PeticaoAdmin(admin.ModelAdmin):
    list_display = ("cliente", "adverso", "responsavel_acao", "area_juridica", "status")
    search_fields = ("cliente__nome", "adverso", "responsavel_acao", "area_juridica")
    list_filter = ("status", "area_juridica", "responsavel_acao")
