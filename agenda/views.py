from django.shortcuts import render
from django.contrib import messages
from agenda.models import Evento
from agenda.forms import EventoForm
from django.http import JsonResponse

# Create your views here.
def listar_eventos(request):
    eventos = Evento.objects.all()
    return render(request, "listar_eventos.html", {"eventos": eventos})

def criar_evento(request):
    if request.method == "POST":
        form = EventoForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "Evento criado com sucesso!")
            return render(request, "criar_evento.html", {"form": EventoForm(), "success": True})
    else:
        form = EventoForm()
    
    return render(request, "criar_evento.html", {"form": form})

def detalhes_evento(request, evento_id):
    evento = Evento.objects.get(id=evento_id)
    return render(request, "detalhes_evento.html", {"evento": evento})

def eventos_json(request):
    eventos = Evento.objects.all()

    data = [
        {
            "title": e.titulo,
            "start": e.data_inicio.isoformat(),
            "end": e.data_fim.isoformat(),
        }
        for e in eventos
    ]

    return JsonResponse(data, safe=False)