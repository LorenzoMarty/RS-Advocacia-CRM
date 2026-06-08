from django import forms

from .models import (
    CATEGORIAS_DESPESA,
    CATEGORIAS_RECEITA,
    Lancamento,
    TIPO_DESPESA,
    TIPO_RECEITA,
)


class LancamentoForm(forms.ModelForm):
    class Meta:
        model = Lancamento
        fields = [
            "descricao",
            "tipo",
            "categoria",
            "valor",
            "data_vencimento",
            "data_pagamento",
            "status",
            "cliente_relacionado",
            "caso_relacionado",
            "observacoes",
        ]
        widgets = {
            "observacoes": forms.Textarea(attrs={"rows": 3}),
            "data_vencimento": forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"}),
            "data_pagamento": forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        for nome in ("data_vencimento", "data_pagamento"):
            field = self.fields.get(nome)
            if isinstance(field, forms.DateField):
                field.input_formats = ("%Y-%m-%d",)
        self.fields["data_pagamento"].required = False

        for nome in ("cliente_relacionado", "caso_relacionado"):
            field = self.fields.get(nome)
            if isinstance(field, forms.ModelChoiceField):
                field.required = False

    def clean(self):
        cleaned = super().clean()
        tipo = cleaned.get("tipo")
        categoria = (cleaned.get("categoria") or "").strip()

        if tipo and categoria:
            permitidas = CATEGORIAS_RECEITA if tipo == TIPO_RECEITA else CATEGORIAS_DESPESA
            if categoria not in permitidas:
                rotulo = "receita" if tipo == TIPO_RECEITA else "despesa"
                self.add_error(
                    "categoria",
                    f"Categoria inválida para {rotulo}.",
                )

        return cleaned
