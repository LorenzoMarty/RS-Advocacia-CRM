from django import forms
from usuarios.models import Usuario

class UsuarioForm(forms.ModelForm):
    class Meta:
        model = Usuario
        fields = ['nome', 'email', 'senha', 'cargo', 'foto', 'OAB']
        widgets = {
            'senha': forms.PasswordInput(render_value=True),
            'foto': forms.FileInput(attrs={'accept': 'image/*'}),
        }

    def save(self, commit=True):
        usuario = super().save(commit=False)
        if self.cleaned_data.get('foto'):
            usuario.foto = self.cleaned_data['foto']
        if commit:
            usuario.save()
        return usuario
