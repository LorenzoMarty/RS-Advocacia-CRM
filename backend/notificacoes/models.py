from django.db import models


class Notificacao(models.Model):
    TIPOS = [
        ("prazo", "Prazo"),
        ("evento", "Evento"),
        ("reuniao", "Reunião"),
        ("sistema", "Sistema"),
    ]

    usuario = models.ForeignKey(
        "usuarios.Usuario",
        on_delete=models.CASCADE,
        related_name="notificacoes",
    )
    tipo = models.CharField(max_length=20, choices=TIPOS)
    titulo = models.CharField(max_length=200)
    mensagem = models.TextField(blank=True)
    link = models.CharField(max_length=200, blank=True)
    lida = models.BooleanField(default=False)
    criada_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-criada_em"]

    def __str__(self):
        return f"{self.usuario} — {self.titulo}"
