from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


TIPO_RECEITA = "receita"
TIPO_DESPESA = "despesa"

TIPOS = (
    (TIPO_RECEITA, "Receita"),
    (TIPO_DESPESA, "Despesa"),
)

STATUS_PENDENTE = "Pendente"
STATUS_PAGO = "Pago"
STATUS_CANCELADO = "Cancelado"

STATUS = (
    (STATUS_PENDENTE, "Pendente"),
    (STATUS_PAGO, "Pago"),
    (STATUS_CANCELADO, "Cancelado"),
)

# "Atrasado" não é armazenado: é derivado em status_exibicao para evitar cron.
STATUS_ATRASADO = "Atrasado"

CATEGORIAS_RECEITA = (
    "Honorários",
    "Consulta",
    "Êxito",
    "Mensalidade",
    "Acordo",
)

CATEGORIAS_DESPESA = (
    "Custas processuais",
    "Escritório",
    "Software",
    "Marketing",
    "Impostos",
    "Outros",
)


class Lancamento(models.Model):
    descricao = models.CharField(max_length=200)
    tipo = models.CharField(max_length=10, choices=TIPOS)
    categoria = models.CharField(max_length=40)
    valor = models.DecimalField(max_digits=12, decimal_places=2)
    data_vencimento = models.DateField()
    data_pagamento = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS, default=STATUS_PENDENTE)
    cliente_relacionado = models.ForeignKey(
        "clientes.Cliente",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lancamentos",
    )
    caso_relacionado = models.ForeignKey(
        "processos.Processo",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lancamentos",
    )
    observacoes = models.TextField(blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-data_vencimento", "id")

    def clean(self):
        if self.valor is not None and self.valor < Decimal("0"):
            raise ValidationError({"valor": "O valor não pode ser negativo."})

        if self.status == STATUS_PAGO and not self.data_pagamento:
            raise ValidationError(
                {"data_pagamento": "Informe a data de pagamento para lançamentos pagos."}
            )

        if self.status != STATUS_PAGO:
            self.data_pagamento = None

    @property
    def atrasado(self):
        return self.status == STATUS_PENDENTE and self.data_vencimento < timezone.localdate()

    @property
    def status_exibicao(self):
        if self.atrasado:
            return STATUS_ATRASADO
        return self.status

    def __str__(self):
        return f"{self.descricao} - {self.valor}"
