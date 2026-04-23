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
    cpf = models.CharField(max_length=14)
    tipo_cliente = models.CharField(max_length=20, choices=TIPOS_CLIENTE, default="esporadico")
    obs = models.TextField(blank=True)

    def __str__(self):
        return self.nome
