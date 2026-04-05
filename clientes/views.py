from django.contrib import messages
from django.shortcuts import redirect, render
from django.urls import reverse
from django.db.models import Q
import re

from clientes.forms import ClienteForm
from clientes.models import Cliente
from core.permissions import app_permissions_required
from core.permission_utils import get_permitted_url_or_fallback

@app_permissions_required("clientes.view_cliente")
def listar_clientes(request):
    busca = request.GET.get("q", "").strip()
    tipo_cliente = request.GET.get("tipo", "todos").strip()
    busca_documento = re.sub(r"\D", "", busca)

    clientes = Cliente.objects.all()

    if busca:
        filtros = (
            Q(nome__icontains=busca)
            | Q(email__icontains=busca)
            | Q(telefone__icontains=busca)
        )
        if busca_documento:
            filtros |= Q(cpf__icontains=busca_documento)
        else:
            filtros |= Q(cpf__icontains=busca)
        clientes = clientes.filter(filtros)

    if tipo_cliente in {"esporadico", "mensalista"}:
        clientes = clientes.filter(tipo_cliente=tipo_cliente)
    else:
        tipo_cliente = "todos"

    context = {
        "clientes": clientes,
        "busca": busca,
        "tipo_cliente": tipo_cliente,
    }
    return render(request, "listar_clientes.html", context)

@app_permissions_required("clientes.add_cliente")
def criar_cliente(request):
    if request.method == "POST":
        form = ClienteForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "Cliente criado com sucesso!")
            return render(request, "criar_cliente.html", {"form": ClienteForm(), "success": True})
    else:
        form = ClienteForm()

    return render(request, "criar_cliente.html", {"form": form})

@app_permissions_required("clientes.view_cliente")
def detalhes_cliente(request, cliente_id):
    cliente = Cliente.objects.get(id=cliente_id)
    return render(request, "detalhes_cliente.html", {"cliente": cliente})

@app_permissions_required("clientes.change_cliente")
def editar_cliente(request, cliente_id):
    cliente = Cliente.objects.get(id=cliente_id)

    if request.method == "POST":
        form = ClienteForm(request.POST, instance=cliente)
        if form.is_valid():
            form.save()
            messages.success(request, "Cliente atualizado com sucesso!")
            return redirect(
                get_permitted_url_or_fallback(
                    request,
                    "clientes.view_cliente",
                    "detalhes_cliente",
                    args=[cliente.pk],
                )
            )
    else:
        form = ClienteForm(instance=cliente)

    context = {"form": form, "editar": True}
    return render(request, "criar_cliente.html", context)

@app_permissions_required("clientes.delete_cliente")
def excluir_cliente(request, cliente_id):
    cliente = Cliente.objects.get(id=cliente_id)

    if request.method == "POST":
        cliente.delete()
        messages.success(request, "Cliente excluido com sucesso!")
        return redirect(
            get_permitted_url_or_fallback(
                request,
                "clientes.view_cliente",
                "listar_clientes",
                fallback_route="logout",
            )
        )

    context = {
        "registro_tipo": "cliente",
        "registro_nome": cliente.nome,
        "registro_meta": cliente.email,
        "voltar_url": reverse("detalhes_cliente", args=[cliente.pk]),
        "voltar_permission": "clientes.view_cliente",
    }
    return render(request, "confirmar_exclusao.html", context)
