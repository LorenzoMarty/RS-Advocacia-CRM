from django import forms
from .models import Processo

class ProcessoForm(forms.ModelForm):
    class Meta:
        model = Processo
        fields = [
            "numero_processo",
            "cliente",
            "descricao",
            "vara",
            "area_juridica",
            "status",
            "advogado_responsavel",
        ]
        widgets = {
            "descricao": forms.Textarea(attrs={"rows": 4}),
        }