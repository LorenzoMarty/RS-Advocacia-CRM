import re

from django.db.models import Q
from django.shortcuts import get_object_or_404

from clientes.forms import ClienteForm
from clientes.models import Cliente
from core.permissions import app_permissions_required
from core.utils import (
    error_response,
    form_errors,
    method_not_allowed,
    parse_body,
    payload_with_aliases,
    success_response,
)


CLIENTE_API_ALIASES = {
    "name": "nome",
    "document": "cpf",
    "clientType": "tipo_cliente",
    "phone": "telefone",
    "notes": "obs",
}


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
        "name": cliente.nome,
        "email": cliente.email,
        "telefone": cliente.telefone,
        "phone": cliente.telefone,
        "cpf": cliente.cpf,
        "document": cliente.cpf,
        "tipo_cliente": cliente.tipo_cliente,
        "clientType": cliente.tipo_cliente,
        "obs": cliente.obs,
        "notes": cliente.obs,
    }


def _cliente_api_payload(request):
    payload = parse_body(request)
    return payload_with_aliases(payload, CLIENTE_API_ALIASES)


@app_permissions_required("clientes.view_cliente")
def listar_clientes(request):
    if request.method != "GET":
        return method_not_allowed(["GET"])

    clientes, busca, tipo_cliente = _filtrar_clientes(request)
    serialized = [serialize_cliente(cliente) for cliente in clientes]
    return success_response(
        {
            "clientes": serialized,
            "clients": serialized,
            "busca": busca,
            "tipo_cliente": tipo_cliente,
        }
    )


@app_permissions_required("clientes.add_cliente")
def criar_cliente(request):
    if request.method != "POST":
        return method_not_allowed(["POST"])

    try:
        payload = _cliente_api_payload(request)
    except ValueError as exc:
        return error_response(str(exc), status=400)

    form = ClienteForm(payload)
    if form.is_valid():
        cliente = form.save()
        serialized = serialize_cliente(cliente)
        return success_response(
            {"cliente": serialized, "client": serialized},
            message="Cliente criado com sucesso.",
            status=201,
        )

    return error_response(form_errors(form), status=400)


@app_permissions_required("clientes.view_cliente")
def detalhes_cliente(request, cliente_id):
    if request.method != "GET":
        return method_not_allowed(["GET"])

    cliente = get_object_or_404(Cliente, pk=cliente_id)
    serialized = serialize_cliente(cliente)
    return success_response({"cliente": serialized, "client": serialized})


@app_permissions_required("clientes.change_cliente")
def editar_cliente(request, cliente_id):
    if request.method not in {"PUT", "PATCH"}:
        return method_not_allowed(["PUT", "PATCH"])

    cliente = get_object_or_404(Cliente, pk=cliente_id)

    try:
        payload = _cliente_api_payload(request)
    except ValueError as exc:
        return error_response(str(exc), status=400)

    form = ClienteForm(payload, instance=cliente)
    if form.is_valid():
        cliente = form.save()
        serialized = serialize_cliente(cliente)
        return success_response(
            {"cliente": serialized, "client": serialized},
            message="Cliente atualizado com sucesso.",
        )

    return error_response(form_errors(form), status=400)


@app_permissions_required("clientes.delete_cliente")
def excluir_cliente(request, cliente_id):
    if request.method != "DELETE":
        return method_not_allowed(["DELETE"])

    cliente = get_object_or_404(Cliente, pk=cliente_id)
    deleted_id = str(cliente.pk)
    cliente.delete()
    return success_response({"id": deleted_id}, message="Cliente excluido com sucesso.")
