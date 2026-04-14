from django import forms

from processos.models import Processo
from usuarios.models import Usuario


AREA_JURIDICA_CHOICES = (
    "Cível",
    "Trabalhista",
    "Empresarial",
    "Consumidor",
)

VARA_CHOICES = (
    "1ª Vara Cível",
    "12ª Vara Cível de São Paulo",
    "18ª Vara do Trabalho de São Paulo",
    "24ª Vara Empresarial de Belo Horizonte",
    "1ª Vara de Família de Curitiba",
    "1ª Vara Cível do Rio de Janeiro",
    "Juizado Especial Cível",
    "Tribunal Regional do Trabalho",
)

STATUS_CHOICES = (
    "Ativo",
    "Em andamento",
    "Fase inicial",
    "Prazo aberto",
    "Aguardando audiência",
    "Audiência marcada",
    "Sentença publicada",
    "Concluído",
    "Arquivado",
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
    area_juridica = forms.ChoiceField(choices=(), label="Área jurídica")
    vara = forms.ChoiceField(choices=(), label="Vara")
    status = forms.ChoiceField(choices=(), label="Status")
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
        current_vara = getattr(instance, "vara", "")
        current_status = getattr(instance, "status", "")
        current_responsavel = getattr(instance, "advogado_responsavel", "")

        existing_varas = Processo.objects.values_list("vara", flat=True)
        existing_statuses = Processo.objects.values_list("status", flat=True)
        existing_responsaveis = Processo.objects.values_list("advogado_responsavel", flat=True)
        usuarios = Usuario.objects.values_list("nome", flat=True)

        cliente_field = self.fields["cliente"]
        if isinstance(cliente_field, forms.ModelChoiceField):
            cliente_field.empty_label = "Selecione o cliente"
        self.fields["area_juridica"].choices = _build_choices(
            "Selecione a área jurídica",
            AREA_JURIDICA_CHOICES,
        )
        self.fields["vara"].choices = _build_choices(
            "Selecione a vara",
            [current_vara],
            VARA_CHOICES,
            existing_varas,
        )
        self.fields["status"].choices = _build_choices(
            "Selecione o status",
            [current_status],
            STATUS_CHOICES,
            existing_statuses,
        )
        self.fields["advogado_responsavel"].choices = _build_choices(
            "Selecione o responsável",
            [current_responsavel],
            usuarios,
            existing_responsaveis,
        )
