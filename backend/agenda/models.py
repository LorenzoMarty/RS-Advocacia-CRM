from django.core.exceptions import ValidationError
from django.db import models
from django.utils.text import slugify


# Modelos da agenda.
class Evento(models.Model):
    titulo = models.CharField(max_length=200)
    descricao = models.TextField(blank=True)
    data_inicio = models.DateTimeField()
    data_fim = models.DateTimeField()
    tipo_evento = models.CharField(max_length=50)
    status = models.CharField(max_length=50)
    prioridade = models.CharField(max_length=50)
    # Nullable: eventos importados do Google Calendar que não correspondem a
    # nenhum cliente/processo real ficam soltos (compromisso geral da agenda),
    # em vez de presos a um cliente/processo técnico sintético.
    cliente = models.ForeignKey(
        "clientes.Cliente", on_delete=models.CASCADE, null=True, blank=True
    )
    processo = models.ForeignKey(
        "processos.Processo", on_delete=models.CASCADE, null=True, blank=True
    )
    responsavel = models.ForeignKey(
        "usuarios.Usuario",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="eventos_responsavel",
    )
    criado_por = models.CharField(max_length=100)
    local = models.CharField(max_length=200)
    observacoes = models.TextField(blank=True)
    lembrete_em = models.DateTimeField(blank=True, null=True)
    lembrete_enviado = models.BooleanField(default=False)
    concluido = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        if "prazo" in slugify(self.tipo_evento or ""):
            raise ValidationError("Prazos devem ser cadastrados no modulo de prazos.")
        if self.data_fim < self.data_inicio:
            raise ValidationError("A data de fim deve ser posterior à data de início.")
        if self.lembrete_em and self.lembrete_em > self.data_inicio:
            raise ValidationError(
                "O lembrete deve ser definido para uma data anterior ao início do evento."
            )

    def __str__(self):
        numero = self.processo.numero_processo if self.processo_id else "sem processo"
        return f"{numero} - {self.data_inicio.strftime('%Y-%m-%d %H:%M')}"
