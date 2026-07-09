from django.db import models


# Modelos de processos.
class Processo(models.Model):
    numero_processo = models.CharField(max_length=30, unique=True)
    cliente = models.ForeignKey("clientes.Cliente", on_delete=models.CASCADE)
    descricao = models.TextField(blank=True)
    vara = models.CharField(max_length=100)
    area_juridica = models.CharField(max_length=100)
    status = models.CharField(max_length=50)
    advogado_responsavel = models.ForeignKey(
        "usuarios.Usuario",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="processos_responsavel",
    )
    data_ultima_movimentacao = models.DateTimeField(auto_now=True)

    def registrar_movimentacao(self):
        """Bump data_ultima_movimentacao without touching other fields."""
        self.save(update_fields=["data_ultima_movimentacao"])

    def __str__(self):
        return self.numero_processo
