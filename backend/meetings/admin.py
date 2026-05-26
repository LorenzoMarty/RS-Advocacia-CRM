from django.contrib import admin

from meetings.models import Gravacao, Reuniao


class GravacaoInline(admin.TabularInline):
    model = Gravacao
    extra = 0
    readonly_fields = ("status", "criada_em", "processada_em")


@admin.register(Reuniao)
class ReuniaoAdmin(admin.ModelAdmin):
    list_display = ("titulo", "cliente", "data_reuniao", "criado_em")
    search_fields = ("titulo", "cliente__nome")
    inlines = (GravacaoInline,)


@admin.register(Gravacao)
class GravacaoAdmin(admin.ModelAdmin):
    list_display = ("reuniao", "status", "nome_original", "criada_em", "processada_em")
    list_filter = ("status",)
    readonly_fields = ("transcricao", "resumo", "erro_processamento")
