from django.contrib import messages
from django.shortcuts import redirect, render
from django.urls import reverse

from processos.forms import ProcessoForm
from processos.models import Processo


def listar_processos(request):
    processos = Processo.objects.all()
    return render(request, "listar_processos.html", {"processos": processos})


def criar_processo(request):
    if request.method == "POST":
        form = ProcessoForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "Processo criado com sucesso!")
            return render(request, "criar_processo.html", {"form": ProcessoForm(), "success": True})
    else:
        form = ProcessoForm()

    return render(request, "criar_processo.html", {"form": form})


def detalhes_processo(request, processo_id):
    processo = Processo.objects.get(id=processo_id)
    return render(request, "detalhes_processo.html", {"processo": processo})


def editar_processo(request, processo_id):
    processo = Processo.objects.get(id=processo_id)

    if request.method == "POST":
        form = ProcessoForm(request.POST, instance=processo)
        if form.is_valid():
            form.save()
            messages.success(request, "Processo atualizado com sucesso!")
            return redirect("detalhes_processo", processo_id=processo.id)
    else:
        form = ProcessoForm(instance=processo)

    context = {"form": form, "editar": True}
    return render(request, "criar_processo.html", context)


def excluir_processo(request, processo_id):
    processo = Processo.objects.get(id=processo_id)

    if request.method == "POST":
        processo.delete()
        messages.success(request, "Processo excluido com sucesso!")
        return redirect("listar_processos")

    context = {
        "registro_tipo": "processo",
        "registro_nome": processo.numero_processo,
        "registro_meta": processo.cliente.nome,
        "voltar_url": reverse("detalhes_processo", args=[processo.id]),
    }
    return render(request, "confirmar_exclusao.html", context)
