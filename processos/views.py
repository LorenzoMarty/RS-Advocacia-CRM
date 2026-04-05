from django.contrib import messages
from django.db.models import Q
from django.shortcuts import redirect, render
from django.urls import reverse

from core.permissions import app_permissions_required
from core.permission_utils import get_permitted_url_or_fallback
from processos.forms import ProcessoForm
from processos.models import Processo

@app_permissions_required("processos.view_processo")
def listar_processos(request):
    busca = request.GET.get("q", "").strip()
    processos = Processo.objects.all()

    if busca:
        processos = processos.filter(
            Q(numero_processo__icontains=busca)
            | Q(cliente__nome__icontains=busca)
            | Q(area_juridica__icontains=busca)
            | Q(vara__icontains=busca)
            | Q(advogado_responsavel__icontains=busca)
            | Q(status__icontains=busca)
        )

    context = {
        "processos": processos,
        "busca": busca,
    }
    return render(request, "listar_processos.html", context)

@app_permissions_required("processos.add_processo")
def criar_processo(request):
    initial = {}
    cliente_id = request.GET.get("cliente")

    if cliente_id and cliente_id.isdigit():
        initial["cliente"] = int(cliente_id)

    if request.method == "POST":
        form = ProcessoForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "Processo criado com sucesso!")
            return render(request, "criar_processo.html", {"form": ProcessoForm(initial=initial), "success": True})
    else:
        form = ProcessoForm(initial=initial)

    return render(request, "criar_processo.html", {"form": form})

@app_permissions_required("processos.view_processo")
def detalhes_processo(request, processo_id):
    processo = Processo.objects.get(id=processo_id)
    return render(request, "detalhes_processo.html", {"processo": processo})

@app_permissions_required("processos.change_processo")
def editar_processo(request, processo_id):
    processo = Processo.objects.get(id=processo_id)

    if request.method == "POST":
        form = ProcessoForm(request.POST, instance=processo)
        if form.is_valid():
            form.save()
            messages.success(request, "Processo atualizado com sucesso!")
            return redirect(
                get_permitted_url_or_fallback(
                    request,
                    "processos.view_processo",
                    "detalhes_processo",
                    args=[processo.pk],
                )
            )
    else:
        form = ProcessoForm(instance=processo)

    context = {"form": form, "editar": True}
    return render(request, "criar_processo.html", context)

@app_permissions_required("processos.delete_processo")
def excluir_processo(request, processo_id):
    processo = Processo.objects.get(id=processo_id)

    if request.method == "POST":
        processo.delete()
        messages.success(request, "Processo excluido com sucesso!")
        return redirect(
            get_permitted_url_or_fallback(
                request,
                "processos.view_processo",
                "listar_processos",
            )
        )

    context = {
        "registro_tipo": "processo",
        "registro_nome": processo.numero_processo,
        "registro_meta": processo.cliente.nome,
        "voltar_url": reverse("detalhes_processo", args=[processo.pk]),
        "voltar_permission": "processos.view_processo",
    }
    return render(request, "confirmar_exclusao.html", context)
