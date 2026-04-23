from django.db import models
from django.core.exceptions import ValidationError


# Modelos da agenda.
class Evento(models.Model):
    titulo = models.CharField(max_length=200)
    descricao = models.TextField(blank=True)
    data_inicio = models.DateTimeField()
    data_fim = models.DateTimeField()
    tipo_evento = models.CharField(max_length=50)
    status = models.CharField(max_length=50)
    prioridade = models.CharField(max_length=50)
    cliente = models.ForeignKey("clientes.Cliente", on_delete=models.CASCADE)
    processo = models.ForeignKey("processos.Processo", on_delete=models.CASCADE)
    responsavel = models.CharField(max_length=100)
    criado_por = models.CharField(max_length=100)
    local = models.CharField(max_length=200)
    observacoes = models.TextField(blank=True)
    lembrete_em = models.DateTimeField(blank=True, null=True)
    concluido = models.BooleanField(default=False)
    google_event_id = models.CharField(max_length=255, null=True, blank=True)

    def clean(self):
        if self.data_fim < self.data_inicio:
            raise ValidationError("A data de fim deve ser posterior à data de início.")
        if self.lembrete_em and self.lembrete_em > self.data_inicio:
            raise ValidationError(
                "O lembrete deve ser definido para uma data anterior ao início do evento."
            )

    def __str__(self):
        return f"{self.processo.numero_processo} - {self.data_inicio.strftime('%Y-%m-%d %H:%M')}"
