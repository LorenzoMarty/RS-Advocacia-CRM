from django import forms

from meetings.models import Reuniao


class ReuniaoForm(forms.ModelForm):
    class Meta:
        model = Reuniao
        fields = ["titulo", "data_reuniao", "cliente"]
