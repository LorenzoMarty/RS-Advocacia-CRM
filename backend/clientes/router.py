import re
from typing import List, Optional

from django.db.models import Q
from django.shortcuts import get_object_or_404
from ninja import Router, Schema

from .models import Cliente

router = Router(tags=["Clientes"])


class ClienteIn(Schema):
    nome: str
    email: str
    telefone: str
    cpf: str
    tipo_cliente: str = "esporadico"
    obs: str = ""


class ClienteOut(Schema):
    id: int
    nome: str
    email: str
    telefone: str
    cpf: str
    tipo_cliente: str
    obs: str


@router.get("", response=List[ClienteOut])
def listar(request, q: str = "", tipo: str = "todos"):
    qs = Cliente.objects.all()

    if q:
        busca_doc = re.sub(r"\D", "", q)
        filtros = Q(nome__icontains=q) | Q(email__icontains=q) | Q(telefone__icontains=q)
        if busca_doc:
            filtros |= Q(cpf__icontains=busca_doc)
        qs = qs.filter(filtros)

    if tipo in {"esporadico", "mensalista"}:
        qs = qs.filter(tipo_cliente=tipo)

    return qs


@router.post("", response={201: ClienteOut})
def criar(request, payload: ClienteIn):
    cliente = Cliente.objects.create(**payload.dict())
    return 201, cliente


@router.get("/{cliente_id}", response=ClienteOut)
def detalhes(request, cliente_id: int):
    return get_object_or_404(Cliente, pk=cliente_id)


@router.put("/{cliente_id}", response=ClienteOut)
def editar(request, cliente_id: int, payload: ClienteIn):
    cliente = get_object_or_404(Cliente, pk=cliente_id)
    for attr, value in payload.dict().items():
        setattr(cliente, attr, value)
    cliente.save()
    return cliente


@router.delete("/{cliente_id}", response={200: dict})
def excluir(request, cliente_id: int):
    cliente = get_object_or_404(Cliente, pk=cliente_id)
    deleted_id = cliente.pk
    cliente.delete()
    return 200, {"id": str(deleted_id), "mensagem": "Cliente excluído com sucesso."}
