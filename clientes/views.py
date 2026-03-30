from django.contrib import messages
from django.shortcuts import redirect, render
from django.urls import reverse

from clientes.forms import ClienteForm
from clientes.models import Cliente


def listar_clientes(request):
    clientes = Cliente.objects.all()
    return render(request, "listar_clientes.html", {"clientes": clientes})


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


def detalhes_cliente(request, cliente_id):
    cliente = Cliente.objects.get(id=cliente_id)
    return render(request, "detalhes_cliente.html", {"cliente": cliente})


def editar_cliente(request, cliente_id):
    cliente = Cliente.objects.get(id=cliente_id)

    if request.method == "POST":
        form = ClienteForm(request.POST, instance=cliente)
        if form.is_valid():
            form.save()
            messages.success(request, "Cliente atualizado com sucesso!")
            return redirect("detalhes_cliente", cliente_id=cliente.id)
    else:
        form = ClienteForm(instance=cliente)

    context = {"form": form, "editar": True}
    return render(request, "criar_cliente.html", context)


def excluir_cliente(request, cliente_id):
    cliente = Cliente.objects.get(id=cliente_id)

    if request.method == "POST":
        cliente.delete()
        messages.success(request, "Cliente excluido com sucesso!")
        return redirect("listar_clientes")

    context = {
        "registro_tipo": "cliente",
        "registro_nome": cliente.nome,
        "registro_meta": cliente.email,
        "voltar_url": reverse("detalhes_cliente", args=[cliente.id]),
    }
    return render(request, "confirmar_exclusao.html", context)
