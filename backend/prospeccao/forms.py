from django import forms

from usuarios.models import Usuario

from .models import (
    InteracaoProspect,
    PRIORIDADES,
    Prospect,
    STATUS_PROSPECCAO,
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


class ProspectForm(forms.ModelForm):
    status_prospeccao = forms.ChoiceField(choices=(), label="Status")
    prioridade = forms.ChoiceField(choices=(), label="Prioridade")

    class Meta:
        model = Prospect
        fields = [
            "nome",
            "telefone",
            "email",
            "origem_contato",
            "tipo_demanda_juridica",
            "descricao_caso",
            "responsavel_interno",
            "status_prospeccao",
            "prioridade",
            "proxima_acao",
            "observacoes",
            "data_ultimo_contato",
        ]
        widgets = {
            "descricao_caso": forms.Textarea(attrs={"rows": 4}),
            "observacoes": forms.Textarea(attrs={"rows": 4}),
            "data_ultimo_contato": forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        field = self.fields.get("data_ultimo_contato")
        if isinstance(field, forms.DateField):
            field.input_formats = ("%Y-%m-%d",)
            field.required = False

        instance = getattr(self, "instance", None)
        current_status = getattr(instance, "status_prospeccao", "")
        current_prioridade = getattr(instance, "prioridade", "")
        existing_status = Prospect.objects.values_list("status_prospeccao", flat=True)

        responsavel_field = self.fields.get("responsavel_interno")
        if isinstance(responsavel_field, forms.ModelChoiceField):
            responsavel_field.empty_label = "Selecione o responsável"
            responsavel_field.required = False
            responsavel_field.queryset = Usuario.objects.order_by("nome")

        self.fields["status_prospeccao"].choices = _build_choices(
            "Selecione o status",
            [current_status],
            STATUS_PROSPECCAO,
            existing_status,
        )
        self.fields["prioridade"].choices = _build_choices(
            "Selecione a prioridade",
            [current_prioridade],
            PRIORIDADES,
        )


class InteracaoForm(forms.ModelForm):
    class Meta:
        model = InteracaoProspect
        fields = ["prospect", "tipo", "descricao", "data", "usuario"]
        widgets = {
            "descricao": forms.Textarea(attrs={"rows": 3}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        usuario_field = self.fields.get("usuario")
        if isinstance(usuario_field, forms.ModelChoiceField):
            usuario_field.required = False
            usuario_field.queryset = Usuario.objects.order_by("nome")
        data_field = self.fields.get("data")
        if data_field is not None:
            data_field.required = False
