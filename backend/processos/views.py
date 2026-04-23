from django.db.models import Q
from django.shortcuts import get_object_or_404

from core.permissions import app_permissions_required
from core.utils import (
    resposta_erro,
    erros_formulario,
    metodo_nao_permitido,
    ler_corpo_json,
    resposta_sucesso,
)
from processos.forms import ProcessoForm
from processos.models import Processo


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
        "cliente_id": str(processo.cliente_id),
        "cliente_nome": cliente_nome,
        "descricao": processo.descricao,
        "vara": processo.vara,
        "area_juridica": processo.area_juridica,
        "status": processo.status,
        "advogado_responsavel": processo.advogado_responsavel,
    }


def _processo_api_payload(request):
    return ler_corpo_json(request)


@app_permissions_required("processos.view_processo")
def listar_processos(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    processos, busca = _filtrar_processos(request)
    processos = processos.select_related("cliente")
    serialized = [serialize_processo(processo) for processo in processos]
    return resposta_sucesso({"processos": serialized, "busca": busca})


@app_permissions_required("processos.add_processo")
def criar_processo(request):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    try:
        payload = _processo_api_payload(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    form = ProcessoForm(payload)
    if form.is_valid():
        processo = form.save()
        processo = Processo.objects.select_related("cliente").get(pk=processo.pk)
        serialized = serialize_processo(processo)
        return resposta_sucesso(
            {"processo": serialized},
            mensagem="Processo criado com sucesso.",
            status=201,
        )

    return resposta_erro(erros_formulario(form), status=400)


@app_permissions_required("processos.view_processo")
def detalhes_processo(request, processo_id):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    processo = get_object_or_404(Processo.objects.select_related("cliente"), pk=processo_id)
    serialized = serialize_processo(processo)
    return resposta_sucesso({"processo": serialized})


@app_permissions_required("processos.change_processo")
def editar_processo(request, processo_id):
    if request.method not in {"PUT", "PATCH"}:
        return metodo_nao_permitido(["PUT", "PATCH"])

    processo = get_object_or_404(Processo, pk=processo_id)

    try:
        payload = _processo_api_payload(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    form = ProcessoForm(payload, instance=processo)
    if form.is_valid():
        processo = form.save()
        processo = Processo.objects.select_related("cliente").get(pk=processo.pk)
        serialized = serialize_processo(processo)
        return resposta_sucesso(
            {"processo": serialized},
            mensagem="Processo atualizado com sucesso.",
        )

    return resposta_erro(erros_formulario(form), status=400)


@app_permissions_required("processos.delete_processo")
def excluir_processo(request, processo_id):
    if request.method != "DELETE":
        return metodo_nao_permitido(["DELETE"])

    processo = get_object_or_404(Processo, pk=processo_id)
    deleted_id = str(processo.pk)
    processo.delete()
    return resposta_sucesso({"id": deleted_id}, mensagem="Processo excluído com sucesso.")
