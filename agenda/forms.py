from django import forms
from .models import Evento


class EventoForm(forms.ModelForm):
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
            "criado_por",
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
