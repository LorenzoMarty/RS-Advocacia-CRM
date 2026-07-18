from django.db import models
from django.utils import timezone

STATUS_PROSPECCAO = (
    "Em contato",
    "Proposta enviada",
    "Aguardando retorno",
    "Perdido",
)

PRIORIDADES = (
    "Baixa",
    "Media",
    "Alta",
)


class Prospect(models.Model):
    nome = models.CharField(max_length=200)
    telefone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    origem_contato = models.CharField(max_length=100, blank=True)
    tipo_demanda_juridica = models.CharField(max_length=120, blank=True)
    descricao_caso = models.TextField(blank=True)
    responsavel_interno = models.ForeignKey(
        "usuarios.Usuario",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="prospects",
    )
    status_prospeccao = models.CharField(max_length=50, default="Em contato")
    prioridade = models.CharField(max_length=20, default="Media")
    proxima_acao = models.CharField(max_length=200, blank=True)
    observacoes = models.TextField(blank=True)
    data_ultimo_contato = models.DateField(null=True, blank=True)
    cliente_convertido = models.ForeignKey(
        "clientes.Cliente",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="prospect_origem",
    )
    convertido_em = models.DateTimeField(null=True, blank=True)
    data_criacao = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-data_criacao", "id")

    def __str__(self):
        return self.nome


class InteracaoProspect(models.Model):
    TIPOS = (
        "ligacao",
        "whatsapp",
        "email",
        "reuniao",
        "anotacao",
    )

    prospect = models.ForeignKey(
        Prospect,
        on_delete=models.CASCADE,
        related_name="interacoes",
    )
    tipo = models.CharField(max_length=20)
    descricao = models.TextField()
    data = models.DateTimeField(default=timezone.now)
    usuario = models.ForeignKey(
        "usuarios.Usuario",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="interacoes_prospect",
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-data", "-id")

    def __str__(self):
        return f"{self.prospect.nome} - {self.tipo}"
