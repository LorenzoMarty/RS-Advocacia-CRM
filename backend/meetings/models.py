from pathlib import Path
from uuid import uuid4

from django.core.exceptions import ValidationError
from django.db import models


def recording_upload_path(instance, filename):
    suffix = Path(filename).suffix.lower()[:10] or ".webm"
    return f"meetings/{instance.reuniao_id}/{uuid4().hex}{suffix}"


class Reuniao(models.Model):
    titulo = models.CharField(max_length=200)
    data_reuniao = models.DateTimeField(null=True, blank=True)
    cliente = models.ForeignKey(
        "clientes.Cliente",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="reunioes",
    )
    processo = models.ForeignKey(
        "processos.Processo",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="reunioes",
    )
    pauta = models.TextField(blank=True)
    criado_por = models.CharField(max_length=100, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-data_reuniao", "-criado_em")

    def clean(self):
        if (
            self.processo_id
            and self.cliente_id
            and self.processo.cliente_id != self.cliente_id
        ):
            raise ValidationError(
                {"processo": "O processo deve pertencer ao cliente selecionado."}
            )

    def __str__(self):
        return self.titulo


class Gravacao(models.Model):
    class Status(models.TextChoices):
        ENVIADA = "enviada", "Enviada"
        TRANSCRIBINDO = "transcribindo", "Transcrevendo"
        RESUMINDO = "resumindo", "Gerando resumo"
        CONCLUIDA = "concluida", "Concluída"
        FALHOU = "falhou", "Falhou"

    reuniao = models.ForeignKey(
        Reuniao,
        on_delete=models.CASCADE,
        related_name="gravacoes",
    )
    arquivo_audio = models.FileField(upload_to=recording_upload_path)
    nome_original = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=100, blank=True)
    tamanho_bytes = models.PositiveBigIntegerField(default=0)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ENVIADA,
    )
    transcricao = models.TextField(blank=True)
    resumo = models.TextField(blank=True)
    provedor = models.CharField(max_length=30, default="openai")
    modelo_transcricao = models.CharField(max_length=80, blank=True)
    modelo_resumo = models.CharField(max_length=80, blank=True)
    erro_processamento = models.TextField(blank=True)
    criada_em = models.DateTimeField(auto_now_add=True)
    processamento_iniciado_em = models.DateTimeField(null=True, blank=True)
    processada_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-criada_em",)

    def __str__(self):
        return f"{self.reuniao} - {self.get_status_display()}"
