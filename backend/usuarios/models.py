from django.contrib.auth.models import Group
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
    cargo = models.CharField(max_length=150)
    google_sub = models.CharField(max_length=255, unique=True, null=True, blank=True)

    @property
    def cargo_label(self):
        return dict(self.TIPOS).get(self.cargo, self.cargo)

    def __str__(self):
        return self.nome


def cargo_lookup_values(cargo_name: str) -> set[str]:
    values = {cargo_name}

    for legacy_value, cargo_label in Usuario.TIPOS:
        if cargo_label == cargo_name:
            values.add(legacy_value)
        if legacy_value == cargo_name:
            values.add(cargo_label)

    return values


class Cargo(Group):
    class Meta:
        proxy = True
        default_permissions = ()
        verbose_name = "Cargo"
        verbose_name_plural = "Cargos"

    def __str__(self):
        return self.name
