from django.db import models

# Create your models here.
class Processo(models.Model):
    numero_processo = models.CharField(max_length=30)
    cliente = models.ForeignKey('clientes.Cliente', on_delete=models.CASCADE)
    descricao = models.TextField(blank=True)
    vara = models.CharField(max_length=100)
    area_juridica = models.CharField(max_length=100)
    status = models.CharField(max_length=50)
    advogado_responsavel = models.CharField(max_length=100)

    def __str__(self):
        return self.numero_processo
