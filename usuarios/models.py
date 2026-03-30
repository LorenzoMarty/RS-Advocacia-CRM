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
    foto = models.ImageField(upload_to='fotos_usuarios/', blank=True)
    OAB = models.CharField(max_length=20, blank=True, null=True)

    def __str__(self):
        return self.nome