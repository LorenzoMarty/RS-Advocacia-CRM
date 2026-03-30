from django import forms
from .models import Cliente

class ClienteForm(forms.ModelForm):
    class Meta:
        model = Cliente
        fields = ["nome", "email", "telefone", "cpf", "obs"]
        widgets = {
            "obs": forms.Textarea(attrs={"rows": 4}),
        }