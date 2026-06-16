from django.contrib import admin

from auditoria.models import RegistroAuditoria


@admin.register(RegistroAuditoria)
class RegistroAuditoriaAdmin(admin.ModelAdmin):
    list_display = (
        "criado_em",
        "acao",
        "entidade_tipo",
        "entidade_rotulo",
        "autor_nome",
    )
    list_filter = ("acao", "entidade_tipo")
    search_fields = ("entidade_rotulo", "autor_nome", "resumo")
    readonly_fields = (
        "acao",
        "entidade_tipo",
        "entidade_id",
        "entidade_rotulo",
        "autor_id",
        "autor_nome",
        "resumo",
        "alteracoes",
        "criado_em",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
