from django import forms
from django.forms.models import ModelChoiceIteratorValue

from usuarios.models import Usuario

from .models import Evento


STATUS_CHOICES = (
    "Agendado",
    "Confirmado",
    "Aguardando",
    "Em andamento",
    "Concluído",
    "Adiado",
    "Cancelado",
    "Atrasado",
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


class ProcessoSelect(forms.Select):
    def create_option(self, name, value, label, selected, index, subindex=None, attrs=None):
        option = super().create_option(name, value, label, selected, index, subindex=subindex, attrs=attrs)

        if isinstance(value, ModelChoiceIteratorValue) and getattr(value, "instance", None):
            option["attrs"]["data-client-id"] = str(value.instance.cliente_id)

        return option


class EventoForm(forms.ModelForm):
    responsavel = forms.ChoiceField(choices=(), label="Responsável")
    status = forms.ChoiceField(choices=(), label="Status")

    class Meta:
        model = Evento
        fields = [
            "titulo",
            "tipo_evento",
            "prioridade",
            "descricao",
            "data_inicio",
            "data_fim",
            "lembrete_em",
            "cliente",
            "processo",
            "responsavel",
            "status",
            "local",
            "observacoes",
            "concluido",
        ]
        widgets = {
            "descricao": forms.Textarea(attrs={"rows": 4}),
            "observacoes": forms.Textarea(attrs={"rows": 4}),
            "data_inicio": forms.DateTimeInput(format="%Y-%m-%dT%H:%M", attrs={"type": "datetime-local"}),
            "data_fim": forms.DateTimeInput(format="%Y-%m-%dT%H:%M", attrs={"type": "datetime-local"}),
            "lembrete_em": forms.DateTimeInput(format="%Y-%m-%dT%H:%M", attrs={"type": "datetime-local"}),
            "concluido": forms.CheckboxInput(),
            "processo": ProcessoSelect(),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        datetime_formats = (
            "%Y-%m-%dT%H:%M",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d %H:%M:%S",
        )

        for field_name in ("data_inicio", "data_fim", "lembrete_em"):
            field = self.fields.get(field_name)
            if isinstance(field, forms.DateTimeField):
                field.input_formats = datetime_formats

        instance = getattr(self, "instance", None)
        current_responsavel = getattr(instance, "responsavel", "")
        current_status = getattr(instance, "status", "")
        usuarios = Usuario.objects.values_list("nome", flat=True)
        existing_responsaveis = Evento.objects.values_list("responsavel", flat=True)
        existing_statuses = Evento.objects.values_list("status", flat=True)

        cliente_field = self.fields.get("cliente")
        processo_field = self.fields.get("processo")

        if isinstance(cliente_field, forms.ModelChoiceField):
            cliente_field.empty_label = "Selecione o cliente"
            cliente_field.queryset = cliente_field.queryset.order_by("nome")

        if isinstance(processo_field, forms.ModelChoiceField):
            processo_field.empty_label = "Selecione o processo"
            processo_field.queryset = processo_field.queryset.select_related("cliente").order_by("numero_processo")

        self.fields["responsavel"].choices = _build_choices(
            "Selecione o responsável",
            [current_responsavel],
            usuarios,
            existing_responsaveis,
        )
        self.fields["status"].choices = _build_choices(
            "Selecione o status",
            [current_status],
            STATUS_CHOICES,
            existing_statuses,
        )
