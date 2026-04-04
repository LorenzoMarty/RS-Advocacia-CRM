from django import forms
from usuarios.models import Usuario

class UsuarioForm(forms.ModelForm):
    class Meta:
        model = Usuario
        fields = ['nome', 'email', 'senha', 'cargo']
        widgets = {
            'senha': forms.PasswordInput(render_value=True),
        }
