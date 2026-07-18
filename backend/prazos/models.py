from django.core.exceptions import ValidationError
from django.db import models


class Prazo(models.Model):
    titulo = models.CharField(max_length=200)
    descricao = models.TextField(blank=True)
    data_limite = models.DateField()
    processo = models.ForeignKey(
        "processos.Processo",
        on_delete=models.CASCADE,
        related_name="prazos",
    )
    responsavel = models.ForeignKey(
        "usuarios.Usuario",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="prazos_responsavel",
    )
    status = models.CharField(max_length=50)
    prioridade = models.CharField(max_length=50, default="Alta")
    observacoes = models.TextField(blank=True)
    # Documento único do prazo no Drive (Doc criado ou arquivo enviado pelo sistema).
    link_drive = models.URLField(max_length=500, blank=True)
    drive_file_id = models.CharField(max_length=255, blank=True, default="")
    concluido = models.BooleanField(default=False)
    notificacao_enviada = models.BooleanField(default=False)
    tempo_decorrido_segundos = models.PositiveIntegerField(default=0)
    timer_iniciado_em = models.DateTimeField(blank=True, null=True)
    criado_por = models.CharField(max_length=100, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("data_limite", "id")
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["data_limite"]),
        ]

    def clean(self):
        if self.processo_id and self.processo.cliente_id is None:
            raise ValidationError(
                "O prazo deve estar vinculado a um processo com cliente."
            )

    def __str__(self):
        return f"{self.processo.numero_processo} - {self.data_limite:%Y-%m-%d}"
