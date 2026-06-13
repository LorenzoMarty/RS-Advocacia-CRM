from django import forms

from processos.models import Processo
from usuarios.models import Usuario

# Seed de áreas jurídicas. O ProcessoForm não usa mais (campo virou texto livre via
# combobox no frontend), mas peticoes.forms reusa esta lista como seed do seu ChoiceField.
AREA_JURIDICA_CHOICES = (
    "Cível",
    "Trabalhista",
    "Empresarial",
    "Tributário",
    "Consumidor",
)


def _normalize_choice_values(*groups):
    values = []
    seen = set()

    for group in groups:
        for raw_value in group:
            value = (raw_value or "").strip()
            key = value.casefold()
            if not value or key in seen:
                continue
            seen.add(key)
            values.append(value)

    return values


def _build_choices(placeholder, *groups):
    values = _normalize_choice_values(*groups)
    return [("", placeholder), *[(value, value) for value in values]]


class ProcessoForm(forms.ModelForm):
    # Texto livre: a UI oferece um select com valores conhecidos + opção de digitar
    # um novo valor, então a API precisa aceitar qualquer string (não uma lista fechada).
    area_juridica = forms.CharField(max_length=100, label="Área jurídica")
    vara = forms.CharField(max_length=100, label="Vara")
    status = forms.CharField(max_length=50, label="Status")
    advogado_responsavel = forms.ChoiceField(choices=(), label="Responsável")

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

        instance = getattr(self, "instance", None)
        current_responsavel = getattr(instance, "advogado_responsavel", "")

        existing_responsaveis = Processo.objects.values_list(
            "advogado_responsavel", flat=True
        )
        usuarios = Usuario.objects.values_list("nome", flat=True)

        cliente_field = self.fields["cliente"]
        if isinstance(cliente_field, forms.ModelChoiceField):
            cliente_field.empty_label = "Selecione o cliente"
        self.fields["advogado_responsavel"].choices = _build_choices(
            "Selecione o responsável",
            [current_responsavel],
            usuarios,
            existing_responsaveis,
        )
