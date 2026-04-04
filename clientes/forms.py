from django import forms
from .models import Cliente

class ClienteForm(forms.ModelForm):
    class Meta:
        model = Cliente
        fields = ["nome", "cpf", "tipo_cliente", "telefone", "email", "obs"]
        widgets = {
            "obs": forms.Textarea(attrs={"rows": 4}),
        }
