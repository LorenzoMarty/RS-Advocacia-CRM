from django.shortcuts import render
from datetime import date
from agenda.models import Evento
from clientes.models import Cliente
from processos.models import Processo

# Create your views here.
def dashboard(request):
    hoje = date.today()

    eventos_hoje = Evento.objects.filter(data_inicio__date=hoje)
    proximos_eventos = Evento.objects.filter(data_inicio__date__gte=hoje).order_by("data_inicio")[:5]

    total_clientes = Cliente.objects.count()
    total_processos = Processo.objects.count()

    context = {
        "eventos_hoje": eventos_hoje,
        "proximos_eventos": proximos_eventos,
        "total_clientes": total_clientes,
        "total_processos": total_processos,
    }

    return render(request, "dashboard.html", context)