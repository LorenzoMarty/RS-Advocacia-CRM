from django import forms
import re

from .models import Cliente

class ClienteForm(forms.ModelForm):
    cpf = forms.CharField(
        max_length=18,
        widget=forms.TextInput(
            attrs={
                "inputmode": "numeric",
                "autocomplete": "off",
                "maxlength": "18",
                "data-cpf-cnpj-input": "true",
            }
        ),
    )

    class Meta:
        model = Cliente
        fields = ["nome", "cpf", "tipo_cliente", "telefone", "email", "obs"]
        widgets = {
            "obs": forms.Textarea(attrs={"rows": 4}),
        }

    def clean_cpf(self):
        cpf = re.sub(r"\D", "", self.cleaned_data.get("cpf", ""))

        if len(cpf) not in {11, 14}:
            raise forms.ValidationError("Informe um CPF com 11 dígitos ou um CNPJ com 14 dígitos.")

        return cpf
