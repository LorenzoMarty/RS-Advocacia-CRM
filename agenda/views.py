from django.contrib import messages
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse

from agenda.forms import EventoForm
from agenda.models import Evento
from core.permissions import app_permissions_required
from core.permission_utils import get_permitted_url_or_fallback


def _resolve_evento_criado_por(request):
    session_name = (request.session.get("usuario_nome") or "").strip()
    if session_name:
        return session_name

    request_user = getattr(request, "user", None)
    if request_user and getattr(request_user, "is_authenticated", False):
        full_name_getter = getattr(request_user, "get_full_name", None)
        if callable(full_name_getter):
            full_name = full_name_getter().strip()
            if full_name:
                return full_name

        for attr in ("first_name", "username", "email"):
            value = (getattr(request_user, attr, "") or "").strip()
            if value:
                return value

    return "Interno"


@app_permissions_required("agenda.view_evento")
def listar_eventos(request):
    eventos = Evento.objects.all()
    return render(request, "listar_eventos.html", {"eventos": eventos})

@app_permissions_required("agenda.add_evento")
def criar_evento(request):
    initial = {}
    cliente_id = request.GET.get("cliente")
    processo_id = request.GET.get("processo")

    if cliente_id and cliente_id.isdigit():
        initial["cliente"] = int(cliente_id)

    if processo_id and processo_id.isdigit():
        initial["processo"] = int(processo_id)

    if request.method == "POST":
        form = EventoForm(request.POST)
        if form.is_valid():
            evento = form.save(commit=False)
            evento.criado_por = _resolve_evento_criado_por(request)
            evento.save()
            messages.success(request, "Evento criado com sucesso!")
            return render(request, "criar_evento.html", {"form": EventoForm(initial=initial), "success": True})
    else:
        form = EventoForm(initial=initial)

    return render(request, "criar_evento.html", {"form": form})

@app_permissions_required("agenda.view_evento")
def detalhes_evento(request, evento_id):
    evento = Evento.objects.get(id=evento_id)
    return render(request, "detalhes_evento.html", {"evento": evento})

@app_permissions_required("agenda.view_evento")
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

@app_permissions_required("agenda.delete_evento")
def excluir_evento(request, evento_id):
    evento = Evento.objects.get(id=evento_id)

    if request.method == "POST":
        evento.delete()
        messages.success(request, "Evento excluido com sucesso!")
        return redirect(
            get_permitted_url_or_fallback(
                request,
                "agenda.view_evento",
                "listar_eventos",
            )
        )

    context = {
        "registro_tipo": "evento",
        "registro_nome": evento.titulo,
        "registro_meta": evento.data_inicio.strftime("%d/%m/%Y %H:%M"),
        "voltar_url": reverse("detalhes_evento", args=[evento.pk]),
        "voltar_permission": "agenda.view_evento",
    }
    return render(request, "confirmar_exclusao.html", context)

@app_permissions_required("agenda.change_evento")
def editar_evento(request, evento_id):
    evento = Evento.objects.get(id=evento_id)

    if request.method == "POST":
        form = EventoForm(request.POST, instance=evento)
        if form.is_valid():
            form.save()
            messages.success(request, "Evento atualizado com sucesso!")
            return redirect(
                get_permitted_url_or_fallback(
                    request,
                    "agenda.view_evento",
                    "detalhes_evento",
                    args=[evento.pk],
                )
            )
    else:
        form = EventoForm(instance=evento)

    context = {"form": form, "editar": True}
    return render(request, "criar_evento.html", context)
