from django.db import models


class RegistroAuditoria(models.Model):
    """Log de atividade de uma entidade (quem fez o quê, quando).

    Escopo por string (``entidade_tipo`` + ``entidade_id``) em vez de FK para
    sobreviver à exclusão da entidade. Autor é snapshot (id + nome), seguindo a
    mesma filosofia de ``Prazo.criado_por`` — não há FK para ``Usuario``.
    """

    ACAO_CRIADO = "criado"
    ACAO_ATUALIZADO = "atualizado"
    ACAO_EXCLUIDO = "excluido"
    ACAO_CHOICES = (
        (ACAO_CRIADO, "Criado"),
        (ACAO_ATUALIZADO, "Atualizado"),
        (ACAO_EXCLUIDO, "Excluído"),
    )

    ENTIDADE_PROCESSO = "processo"
    ENTIDADE_PRAZO = "prazo"
    ENTIDADE_CHOICES = (
        (ENTIDADE_PROCESSO, "Processo"),
        (ENTIDADE_PRAZO, "Prazo"),
    )

    acao = models.CharField(max_length=20, choices=ACAO_CHOICES)
    entidade_tipo = models.CharField(max_length=20, choices=ENTIDADE_CHOICES)
    entidade_id = models.CharField(max_length=40)
    entidade_rotulo = models.CharField(max_length=255, blank=True)
    autor_id = models.IntegerField(null=True, blank=True)
    autor_nome = models.CharField(max_length=150, blank=True)
    resumo = models.CharField(max_length=500)
    alteracoes = models.JSONField(default=dict, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("-criado_em", "-id")
        indexes = [
            models.Index(fields=["entidade_tipo", "entidade_id"]),
        ]
        verbose_name = "Registro de auditoria"
        verbose_name_plural = "Registros de auditoria"

    def __str__(self) -> str:
        return self.resumo
