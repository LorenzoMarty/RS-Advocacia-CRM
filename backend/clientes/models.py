from django.db import models


# Modelos de clientes.
class Cliente(models.Model):
    TIPOS_CLIENTE = [
        ("esporadico", "Esporádico"),
        ("mensalista", "Mensalista"),
    ]

    nome = models.CharField(max_length=100)
    email = models.EmailField()
    telefone = models.CharField(max_length=20)
    cpf = models.CharField(max_length=14, blank=True, default="")
    tipo_cliente = models.CharField(
        max_length=20, choices=TIPOS_CLIENTE, default="esporadico"
    )
    parceria = models.CharField(max_length=120, blank=True, default="")
    obs = models.TextField(blank=True)
    # Set to False by the Drive sync when the client's Drive folder is
    # trashed, instead of deleting the client record.
    ativo = models.BooleanField(default=True)

    class Meta:
        constraints = [
            # Clientes importados em massa do Drive podem ficar sem CPF até
            # o advogado preencher depois; só exige unicidade quando preenchido.
            models.UniqueConstraint(
                fields=["cpf"],
                condition=~models.Q(cpf=""),
                name="cliente_cpf_unico_quando_preenchido",
            ),
        ]

    def __str__(self):
        return self.nome
