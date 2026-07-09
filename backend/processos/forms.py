from django import forms

from processos.models import Processo

# Seed de áreas jurídicas. O ProcessoForm não usa mais (campo virou texto livre via
# combobox no frontend), mas peticoes.forms reusa esta lista como seed do seu ChoiceField.
AREA_JURIDICA_CHOICES = (
    "Cível",
    "Trabalhista",
    "Empresarial",
    "Tributário",
    "Consumidor",
)


class ProcessoForm(forms.ModelForm):
    # Texto livre: a UI oferece um select com valores conhecidos + opção de digitar
    # um novo valor, então a API precisa aceitar qualquer string (não uma lista fechada).
    area_juridica = forms.CharField(max_length=100, label="Área jurídica")
    vara = forms.CharField(max_length=100, label="Vara")
    status = forms.CharField(max_length=50, label="Status")

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

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        cliente_field = self.fields["cliente"]
        if isinstance(cliente_field, forms.ModelChoiceField):
            cliente_field.empty_label = "Selecione o cliente"

        responsavel_field = self.fields["advogado_responsavel"]
        if isinstance(responsavel_field, forms.ModelChoiceField):
            responsavel_field.empty_label = "Selecione o responsável"
