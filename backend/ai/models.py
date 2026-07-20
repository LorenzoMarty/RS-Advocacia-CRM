from django.db import models

from integrations.google.tokens import decrypt_value, encrypt_value

# Preço estimado por 1M de tokens (USD), mantido manualmente — a API da OpenAI não
# devolve custo em $ na resposta, só contagem de tokens. Atualizar quando a OpenAI
# mudar preço. Modelo não listado aqui conta como custo zero (best-effort).
PRECO_POR_MILHAO_TOKENS_USD = {
    "gpt-4o-transcribe": {"entrada": 6.00, "saida": 10.00},
    "gpt-4.1-mini": {"entrada": 0.40, "saida": 1.60},
    "gpt-4.1": {"entrada": 2.00, "saida": 8.00},
}


def estimar_custo_usd(modelo: str, tokens_entrada: int, tokens_saida: int) -> float:
    preco = PRECO_POR_MILHAO_TOKENS_USD.get(modelo)
    if not preco:
        return 0.0
    return (
        tokens_entrada * preco["entrada"] / 1_000_000
        + tokens_saida * preco["saida"] / 1_000_000
    )


class ConfiguracaoIA(models.Model):
    """Configuração única (singleton) do provedor de IA do escritório."""

    api_key_ciphertext = models.TextField(blank=True, default="")
    atualizado_em = models.DateTimeField(auto_now=True)
    atualizado_por = models.ForeignKey(
        "usuarios.Usuario", null=True, blank=True, on_delete=models.SET_NULL
    )

    @property
    def api_key(self) -> str:
        return decrypt_value(self.api_key_ciphertext)

    def set_api_key(self, valor: str) -> None:
        self.api_key_ciphertext = encrypt_value(valor.strip()) if valor else ""

    @classmethod
    def obter_api_key_ativa(cls) -> str:
        config = cls.objects.first()
        return config.api_key if config else ""

    def __str__(self) -> str:
        return "Configuração de IA"


class UsoIA(models.Model):
    OPERACAO_TRANSCRICAO = "transcricao"
    OPERACAO_RESUMO = "resumo"
    OPERACAO_REFINE = "refine"
    OPERACAO_DRIVE = "drive"
    OPERACAO_CHOICES = [
        (OPERACAO_TRANSCRICAO, "Transcrição"),
        (OPERACAO_RESUMO, "Resumo"),
        (OPERACAO_REFINE, "Refinamento de resumo"),
        (OPERACAO_DRIVE, "Classificação/organização de Drive"),
    ]

    operacao = models.CharField(max_length=20, choices=OPERACAO_CHOICES)
    modelo = models.CharField(max_length=100, blank=True, default="")
    tokens_entrada = models.PositiveIntegerField(default=0)
    tokens_saida = models.PositiveIntegerField(default=0)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["criado_em"])]

    @property
    def custo_usd(self) -> float:
        return estimar_custo_usd(self.modelo, self.tokens_entrada, self.tokens_saida)

    def __str__(self) -> str:
        return f"{self.operacao} ({self.modelo}): {self.tokens_entrada}+{self.tokens_saida} tok"
