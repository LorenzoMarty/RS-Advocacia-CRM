from django.db.models import Q
from django.shortcuts import get_object_or_404

from core.permissions import app_permissions_required
from core.utils import (
    error_response,
    form_errors,
    method_not_allowed,
    parse_body,
    payload_with_aliases,
    success_response,
)
from processos.forms import ProcessoForm
from processos.models import Processo


PROCESSO_API_ALIASES = {
    "number": "numero_processo",
    "clientId": "cliente",
    "description": "descricao",
    "court": "vara",
    "area": "area_juridica",
    "owner": "advogado_responsavel",
}


def _filtrar_processos(request):
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

    return processos, busca


def serialize_processo(processo):
    cliente_nome = processo.cliente.nome if processo.cliente_id else ""
    return {
        "id": str(processo.pk),
        "pk": processo.pk,
        "numero_processo": processo.numero_processo,
        "number": processo.numero_processo,
        "cliente_id": str(processo.cliente_id),
        "clientId": str(processo.cliente_id),
        "cliente_nome": cliente_nome,
        "clientName": cliente_nome,
        "descricao": processo.descricao,
        "description": processo.descricao,
        "vara": processo.vara,
        "court": processo.vara,
        "area_juridica": processo.area_juridica,
        "area": processo.area_juridica,
        "status": processo.status,
        "advogado_responsavel": processo.advogado_responsavel,
        "owner": processo.advogado_responsavel,
    }


def _processo_api_payload(request):
    payload = parse_body(request)
    return payload_with_aliases(payload, PROCESSO_API_ALIASES)


@app_permissions_required("processos.view_processo")
def listar_processos(request):
    if request.method != "GET":
        return method_not_allowed(["GET"])

    processos, busca = _filtrar_processos(request)
    processos = processos.select_related("cliente")
    serialized = [serialize_processo(processo) for processo in processos]
    return success_response({"processos": serialized, "processes": serialized, "busca": busca})


@app_permissions_required("processos.add_processo")
def criar_processo(request):
    if request.method != "POST":
        return method_not_allowed(["POST"])

    try:
        payload = _processo_api_payload(request)
    except ValueError as exc:
        return error_response(str(exc), status=400)

    form = ProcessoForm(payload)
    if form.is_valid():
        processo = form.save()
        processo = Processo.objects.select_related("cliente").get(pk=processo.pk)
        serialized = serialize_processo(processo)
        return success_response(
            {"processo": serialized, "process": serialized},
            message="Processo criado com sucesso.",
            status=201,
        )

    return error_response(form_errors(form), status=400)


@app_permissions_required("processos.view_processo")
def detalhes_processo(request, processo_id):
    if request.method != "GET":
        return method_not_allowed(["GET"])

    processo = get_object_or_404(Processo.objects.select_related("cliente"), pk=processo_id)
    serialized = serialize_processo(processo)
    return success_response({"processo": serialized, "process": serialized})


@app_permissions_required("processos.change_processo")
def editar_processo(request, processo_id):
    if request.method not in {"PUT", "PATCH"}:
        return method_not_allowed(["PUT", "PATCH"])

    processo = get_object_or_404(Processo, pk=processo_id)

    try:
        payload = _processo_api_payload(request)
    except ValueError as exc:
        return error_response(str(exc), status=400)

    form = ProcessoForm(payload, instance=processo)
    if form.is_valid():
        processo = form.save()
        processo = Processo.objects.select_related("cliente").get(pk=processo.pk)
        serialized = serialize_processo(processo)
        return success_response(
            {"processo": serialized, "process": serialized},
            message="Processo atualizado com sucesso.",
        )

    return error_response(form_errors(form), status=400)


@app_permissions_required("processos.delete_processo")
def excluir_processo(request, processo_id):
    if request.method != "DELETE":
        return method_not_allowed(["DELETE"])

    processo = get_object_or_404(Processo, pk=processo_id)
    deleted_id = str(processo.pk)
    processo.delete()
    return success_response({"id": deleted_id}, message="Processo excluido com sucesso.")
