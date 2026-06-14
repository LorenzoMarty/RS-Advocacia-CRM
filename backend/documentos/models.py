from django.db import models

from core.utils import isoformat_ou_nulo


class ClienteDrive(models.Model):
    """Cache of the Google Drive folder ids for a client's document tree.

    The Drive folder structure is ``Clientes/<Nome>/{Petições,Documentos,Outros}``.
    Storing the ids keyed by client primary key keeps the mapping stable even if
    two clients share the same name, and avoids re-querying Drive on every request.
    """

    cliente = models.OneToOneField(
        "clientes.Cliente",
        on_delete=models.CASCADE,
        related_name="drive",
    )
    pasta_cliente_id = models.CharField(max_length=255)
    pasta_peticoes_id = models.CharField(max_length=255)
    pasta_documentos_id = models.CharField(max_length=255)
    pasta_outros_id = models.CharField(max_length=255)
    # Pasta "Reuniões" do cliente (áudios e documentos de reunião). Preenchida
    # sob demanda no primeiro uso (lazy-create), por isso aceita vazio.
    pasta_reunioes_id = models.CharField(max_length=255, blank=True, default="")
    atualizado_em = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Drive de {self.cliente.nome}"

    def pasta_para_categoria(self, categoria: str) -> str:
        return {
            DocumentoCliente.CATEGORIA_PETICAO: self.pasta_peticoes_id,
            DocumentoCliente.CATEGORIA_DOCUMENTO: self.pasta_documentos_id,
            DocumentoCliente.CATEGORIA_OUTRO: self.pasta_outros_id,
        }[categoria]


class DocumentoCliente(models.Model):
    """Metadata mirror of a file stored in the client's Google Drive folder.

    Drive remains the source of truth for the binary; this table exists so the
    backend/frontend can list and search documents without a Drive round-trip.
    """

    CATEGORIA_PETICAO = "petition"
    CATEGORIA_DOCUMENTO = "document"
    CATEGORIA_OUTRO = "other"
    CATEGORIA_CHOICES = (
        (CATEGORIA_PETICAO, "Petição"),
        (CATEGORIA_DOCUMENTO, "Documento"),
        (CATEGORIA_OUTRO, "Outro"),
    )

    # Maps a category to its Drive subfolder name (Portuguese, per Drive layout).
    CATEGORIA_SUBPASTA = {
        CATEGORIA_PETICAO: "Petições",
        CATEGORIA_DOCUMENTO: "Documentos",
        CATEGORIA_OUTRO: "Outros",
    }

    cliente = models.ForeignKey(
        "clientes.Cliente",
        on_delete=models.CASCADE,
        related_name="documentos",
    )
    categoria = models.CharField(
        max_length=20,
        choices=CATEGORIA_CHOICES,
        default=CATEGORIA_DOCUMENTO,
    )
    nome = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=150, blank=True)
    tamanho_bytes = models.PositiveBigIntegerField(default=0)
    drive_file_id = models.CharField(max_length=255, unique=True)
    drive_folder_id = models.CharField(max_length=255)
    link_visualizacao = models.URLField(max_length=1000, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("cliente__nome", "categoria", "nome")
        constraints = [
            models.UniqueConstraint(
                fields=("cliente", "categoria", "nome"),
                name="documento_unico_por_cliente_categoria_nome",
            )
        ]

    def __str__(self):
        return f"{self.cliente.nome} / {self.get_categoria_display()} / {self.nome}"


class PastaGerenciada(models.Model):
    """A user-created Drive folder whose display name carries an auto number.

    Only folders created through the documents explorer are tracked here. The
    Drive display name is ``"<ordem>. <nome_base>"``; deleting one renumbers the
    siblings under the same parent so the sequence never has a gap. Structural
    folders (Petições/Documentos/Outros, template and per-process folders) are
    located by name elsewhere and are intentionally NOT tracked/renumbered.
    """

    cliente = models.ForeignKey(
        "clientes.Cliente",
        on_delete=models.CASCADE,
        related_name="pastas_gerenciadas",
    )
    parent_drive_id = models.CharField(max_length=255)
    drive_folder_id = models.CharField(max_length=255, unique=True)
    ordem = models.PositiveIntegerField()
    nome_base = models.CharField(max_length=255)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("parent_drive_id", "ordem")

    def __str__(self):
        return f"{self.ordem}. {self.nome_base}"

    @property
    def nome_exibicao(self) -> str:
        return f"{self.ordem}. {self.nome_base}"


def serialize_documento(documento: DocumentoCliente):
    return {
        "id": str(documento.pk),
        "pk": documento.pk,
        "cliente": str(documento.cliente_id),
        "categoria": documento.categoria,
        "nome": documento.nome,
        "mime_type": documento.mime_type,
        "tamanho_bytes": documento.tamanho_bytes,
        "drive_file_id": documento.drive_file_id,
        "drive_folder_id": documento.drive_folder_id,
        "link_visualizacao": documento.link_visualizacao,
        "criado_em": isoformat_ou_nulo(documento.criado_em),
        "atualizado_em": isoformat_ou_nulo(documento.atualizado_em),
    }
