from django import forms

from .models import DocumentoCliente


class UploadDocumentoForm(forms.Form):
    """Validates the non-file fields of a document upload request."""

    categoria = forms.ChoiceField(choices=DocumentoCliente.CATEGORIA_CHOICES)
    nome = forms.CharField(max_length=255, required=False)
