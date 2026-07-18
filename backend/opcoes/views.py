from django.shortcuts import get_object_or_404

from core.permissions import app_permissions_required
from core.utils import (
    ler_corpo_json,
    metodo_nao_permitido,
    resposta_erro,
    resposta_sucesso,
)

from .models import CAMPOS_VALIDOS, OpcaoPersonalizada


def _serialize(opcao: OpcaoPersonalizada):
    return {"id": opcao.pk, "campo": opcao.campo, "valor": opcao.valor}


def _validar_campo(campo: str):
    if campo not in CAMPOS_VALIDOS:
        return resposta_erro({"campo": ["Campo inválido."]}, status=400)
    return None


@app_permissions_required()
def listar_opcoes(request, campo):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    erro = _validar_campo(campo)
    if erro:
        return erro

    itens = OpcaoPersonalizada.objects.filter(campo=campo).order_by("valor")
    return resposta_sucesso({"itens": [_serialize(o) for o in itens]})


@app_permissions_required()
def criar_opcao(request, campo):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    erro = _validar_campo(campo)
    if erro:
        return erro

    try:
        payload = ler_corpo_json(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    valor = (payload.get("valor") or "").strip()
    if not valor:
        return resposta_erro({"valor": ["Informe um valor."]}, status=400)

    opcao, criado = OpcaoPersonalizada.objects.get_or_create(campo=campo, valor=valor)
    return resposta_sucesso(
        {"opcao": _serialize(opcao)},
        mensagem="Opção criada." if criado else "Opção já existia.",
        status=201 if criado else 200,
    )


@app_permissions_required()
def apagar_opcao(request, campo, opcao_id):
    if request.method != "DELETE":
        return metodo_nao_permitido(["DELETE"])

    erro = _validar_campo(campo)
    if erro:
        return erro

    opcao = get_object_or_404(OpcaoPersonalizada, pk=opcao_id, campo=campo)
    opcao.delete()
    return resposta_sucesso({"id": opcao_id}, mensagem="Opção removida.")
