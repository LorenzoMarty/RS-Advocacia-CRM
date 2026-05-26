from django import forms

from processos.models import Processo
from usuarios.models import Usuario

from .models import Prazo


STATUS_CHOICES = (
    "Pendente",
    "A fazer",
    "Em andamento",
    "Protocolar",
    "Protocolado",
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


class PrazoForm(forms.ModelForm):
    responsavel = forms.ChoiceField(choices=(), label="Responsavel")
    status = forms.ChoiceField(choices=(), label="Status")

    class Meta:
        model = Prazo
        fields = [
            "titulo",
            "descricao",
            "data_limite",
            "processo",
            "responsavel",
            "status",
            "prioridade",
            "observacoes",
            "concluido",
        ]
        widgets = {
            "descricao": forms.Textarea(attrs={"rows": 4}),
            "observacoes": forms.Textarea(attrs={"rows": 4}),
            "data_limite": forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        field = self.fields.get("data_limite")
        if isinstance(field, forms.DateField):
            field.input_formats = ("%Y-%m-%d",)

        instance = getattr(self, "instance", None)
        current_responsavel = getattr(instance, "responsavel", "")
        current_status = getattr(instance, "status", "")
        usuarios = Usuario.objects.values_list("nome", flat=True)
        responsaveis_processos = Processo.objects.values_list("advogado_responsavel", flat=True)
        existing_responsaveis = Prazo.objects.values_list("responsavel", flat=True)
        existing_statuses = Prazo.objects.values_list("status", flat=True)

        processo_field = self.fields.get("processo")
        if isinstance(processo_field, forms.ModelChoiceField):
            processo_field.empty_label = "Selecione o processo"
            processo_field.queryset = processo_field.queryset.select_related("cliente").order_by("numero_processo")

        self.fields["responsavel"].choices = _build_choices(
            "Selecione o responsavel",
            [current_responsavel],
            usuarios,
            responsaveis_processos,
            existing_responsaveis,
        )
        self.fields["status"].choices = _build_choices(
            "Selecione o status",
            [current_status],
            STATUS_CHOICES,
            existing_statuses,
        )
