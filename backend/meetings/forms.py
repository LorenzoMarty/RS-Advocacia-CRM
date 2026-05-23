from django import forms

from meetings.models import Reuniao


class ReuniaoForm(forms.ModelForm):
    class Meta:
        model = Reuniao
        fields = ["titulo", "data_reuniao", "cliente", "processo", "pauta"]

    def clean(self):
        cleaned_data = super().clean()
        cliente = cleaned_data.get("cliente")
        processo = cleaned_data.get("processo")
        if cliente and processo and processo.cliente_id != cliente.pk:
            self.add_error(
                "processo",
                "O processo deve pertencer ao cliente selecionado.",
            )
        return cleaned_data
