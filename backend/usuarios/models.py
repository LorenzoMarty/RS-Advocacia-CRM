from django.db import models


# Create your models here.
class Usuario(models.Model):
    TIPOS = [
        ("admin", "Administrador"),
        ("advogado", "Advogado"),
        ("estagiario", "Estagiário"),
    ]

    nome = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    senha = models.CharField(max_length=100)
    cargo = models.CharField(max_length=50, choices=TIPOS)

    @property
    def cargo_label(self):
        return dict(self.TIPOS).get(self.cargo, self.cargo)

    def __str__(self):
        return self.nome
