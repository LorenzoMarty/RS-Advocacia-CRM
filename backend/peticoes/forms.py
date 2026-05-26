from django import forms

from processos.forms import AREA_JURIDICA_CHOICES
from usuarios.models import Usuario

from .models import Peticao


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


class PeticaoForm(forms.ModelForm):
    tipo = forms.ChoiceField(choices=Peticao.TIPO_CHOICES, label="Tipo")
    responsavel_acao = forms.ChoiceField(choices=(), label="Responsavel pela acao")
    area_juridica = forms.ChoiceField(choices=(), label="Area juridica")
    status = forms.ChoiceField(choices=Peticao.STATUS_CHOICES, label="Status")

    class Meta:
        model = Peticao
        fields = [
            "cliente",
            "tipo",
            "adverso",
            "responsavel_acao",
            "link_drive",
            "motivo_pendente",
            "area_juridica",
            "status",
        ]
        widgets = {
            "motivo_pendente": forms.Textarea(attrs={"rows": 4}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        instance = getattr(self, "instance", None)
        current_responsavel = getattr(instance, "responsavel_acao", "")
        current_area = getattr(instance, "area_juridica", "")
        usuarios = Usuario.objects.values_list("nome", flat=True)
        existing_responsaveis = Peticao.objects.values_list("responsavel_acao", flat=True)
        existing_areas = Peticao.objects.values_list("area_juridica", flat=True)

        cliente_field = self.fields.get("cliente")
        if isinstance(cliente_field, forms.ModelChoiceField):
            cliente_field.empty_label = "Selecione o cliente"
            cliente_field.queryset = cliente_field.queryset.order_by("nome")

        self.fields["responsavel_acao"].choices = _build_choices(
            "Selecione o responsavel",
            [current_responsavel],
            usuarios,
            existing_responsaveis,
        )
        self.fields["area_juridica"].choices = _build_choices(
            "Selecione a area juridica",
            [current_area],
            AREA_JURIDICA_CHOICES,
            existing_areas,
        )
