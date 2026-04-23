import re

from django.db.models import Q
from django.shortcuts import get_object_or_404

from clientes.forms import ClienteForm
from clientes.models import Cliente
from core.permissions import app_permissions_required
from core.utils import (
    resposta_erro,
    erros_formulario,
    metodo_nao_permitido,
    ler_corpo_json,
    resposta_sucesso,
)


def _filtrar_clientes(request):
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

    return clientes, busca, tipo_cliente


def serialize_cliente(cliente):
    return {
        "id": str(cliente.pk),
        "pk": cliente.pk,
        "nome": cliente.nome,
        "email": cliente.email,
        "telefone": cliente.telefone,
        "cpf": cliente.cpf,
        "tipo_cliente": cliente.tipo_cliente,
        "obs": cliente.obs,
    }


def _cliente_api_payload(request):
    payload = ler_corpo_json(request)
    return payload


@app_permissions_required("clientes.view_cliente")
def listar_clientes(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    clientes, busca, tipo_cliente = _filtrar_clientes(request)
    serialized = [serialize_cliente(cliente) for cliente in clientes]
    return resposta_sucesso(
        {
            "clientes": serialized,
            "busca": busca,
            "tipo_cliente": tipo_cliente,
        }
    )


@app_permissions_required("clientes.add_cliente")
def criar_cliente(request):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    try:
        payload = _cliente_api_payload(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    form = ClienteForm(payload)
    if form.is_valid():
        cliente = form.save()
        serialized = serialize_cliente(cliente)
        return resposta_sucesso(
            {"cliente": serialized},
            mensagem="Cliente criado com sucesso.",
            status=201,
        )

    return resposta_erro(erros_formulario(form), status=400)


@app_permissions_required("clientes.view_cliente")
def detalhes_cliente(request, cliente_id):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    cliente = get_object_or_404(Cliente, pk=cliente_id)
    serialized = serialize_cliente(cliente)
    return resposta_sucesso({"cliente": serialized})


@app_permissions_required("clientes.change_cliente")
def editar_cliente(request, cliente_id):
    if request.method not in {"PUT", "PATCH"}:
        return metodo_nao_permitido(["PUT", "PATCH"])

    cliente = get_object_or_404(Cliente, pk=cliente_id)

    try:
        payload = _cliente_api_payload(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    form = ClienteForm(payload, instance=cliente)
    if form.is_valid():
        cliente = form.save()
        serialized = serialize_cliente(cliente)
        return resposta_sucesso(
            {"cliente": serialized},
            mensagem="Cliente atualizado com sucesso.",
        )

    return resposta_erro(erros_formulario(form), status=400)


@app_permissions_required("clientes.delete_cliente")
def excluir_cliente(request, cliente_id):
    if request.method != "DELETE":
        return metodo_nao_permitido(["DELETE"])

    cliente = get_object_or_404(Cliente, pk=cliente_id)
    deleted_id = str(cliente.pk)
    cliente.delete()
    return resposta_sucesso({"id": deleted_id}, mensagem="Cliente excluído com sucesso.")
