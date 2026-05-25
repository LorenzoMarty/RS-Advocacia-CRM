from django.core.exceptions import ValidationError
from django.db import models


class Peticao(models.Model):
    STATUS_PENDENTE = "Pendente"
    STATUS_EM_ANDAMENTO = "Em andamento"
    STATUS_PROTOCOLAR = "Protocolar"
    STATUS_PROTOCOLADO = "Protocolado"

    STATUS_CHOICES = (
        (STATUS_PENDENTE, STATUS_PENDENTE),
        (STATUS_EM_ANDAMENTO, STATUS_EM_ANDAMENTO),
        (STATUS_PROTOCOLAR, STATUS_PROTOCOLAR),
        (STATUS_PROTOCOLADO, STATUS_PROTOCOLADO),
    )

    cliente = models.ForeignKey(
        "clientes.Cliente",
        on_delete=models.CASCADE,
        related_name="peticoes",
    )
    adverso = models.CharField(max_length=200)
    responsavel_acao = models.CharField(max_length=100)
    link_drive = models.URLField(max_length=500, blank=True)
    motivo_pendente = models.TextField(blank=True)
    area_juridica = models.CharField(max_length=100)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default=STATUS_PENDENTE)
    criado_por = models.CharField(max_length=100, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("status", "cliente__nome", "adverso")

    def clean(self):
        if self.status == self.STATUS_PENDENTE and not self.motivo_pendente.strip():
            raise ValidationError({"motivo_pendente": "Informe o motivo da pendencia."})

    def __str__(self):
        return f"{self.cliente.nome} x {self.adverso}"
