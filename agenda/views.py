from django.contrib import messages
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse

from agenda.forms import EventoForm
from agenda.models import Evento


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
        initial = {}
        cliente_id = request.GET.get("cliente")
        processo_id = request.GET.get("processo")

        if cliente_id and cliente_id.isdigit():
            initial["cliente"] = int(cliente_id)

        if processo_id and processo_id.isdigit():
            initial["processo"] = int(processo_id)

        form = EventoForm(initial=initial)

    return render(request, "criar_evento.html", {"form": form})


def detalhes_evento(request, evento_id):
    evento = Evento.objects.get(id=evento_id)
    return render(request, "detalhes_evento.html", {"evento": evento})


def eventos_json(request):
    eventos = Evento.objects.all()

    data = [
        {
            "title": evento.titulo,
            "start": evento.data_inicio.isoformat(),
            "end": evento.data_fim.isoformat(),
        }
        for evento in eventos
    ]

    return JsonResponse(data, safe=False)


def excluir_evento(request, evento_id):
    evento = Evento.objects.get(id=evento_id)

    if request.method == "POST":
        evento.delete()
        messages.success(request, "Evento excluido com sucesso!")
        return redirect("listar_eventos")

    context = {
        "registro_tipo": "evento",
        "registro_nome": evento.titulo,
        "registro_meta": evento.data_inicio.strftime("%d/%m/%Y %H:%M"),
        "voltar_url": reverse("detalhes_evento", args=[evento.id]),
    }
    return render(request, "confirmar_exclusao.html", context)


def editar_evento(request, evento_id):
    evento = Evento.objects.get(id=evento_id)

    if request.method == "POST":
        form = EventoForm(request.POST, instance=evento)
        if form.is_valid():
            form.save()
            messages.success(request, "Evento atualizado com sucesso!")
            return redirect("detalhes_evento", evento_id=evento.id)
    else:
        form = EventoForm(instance=evento)

    context = {"form": form, "editar": True}
    return render(request, "criar_evento.html", context)
