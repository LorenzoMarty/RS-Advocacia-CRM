from django.shortcuts import get_object_or_404

from auditoria import services as auditoria_services
from auditoria.models import RegistroAuditoria
from core.permissions import app_permissions_required
from core.utils import (
    erros_formulario,
    isoformat_ou_nulo,
    ler_corpo_json,
    metodo_nao_permitido,
    resolver_criador,
    resposta_erro,
    resposta_sucesso,
)
from documentos import services as documentos_services
from integrations.google.exceptions import GOOGLE_ERRORS
from integrations.google.oauth import current_usuario
from integrations.google.responses import mapear_erro_google
from peticoes.forms import PeticaoForm
from peticoes.models import Peticao


def serialize_peticao(peticao: Peticao):
    return {
        "id": str(peticao.pk),
        "pk": peticao.pk,
        "cliente_id": str(peticao.cliente_id),
        "cliente_nome": peticao.cliente.nome if peticao.cliente_id else "",
        "processo_id": str(peticao.processo_id) if peticao.processo_id else "",
        "processo_numero": (
            peticao.processo.numero_processo if peticao.processo else ""
        ),
        "tipo": peticao.tipo,
        "adverso": peticao.adverso,
        "responsavel_acao": peticao.responsavel_acao,
        "link_drive": peticao.link_drive,
        "drive_file_id": peticao.drive_file_id,
        "motivo_pendente": peticao.motivo_pendente,
        "area_juridica": (
            peticao.processo.area_juridica if peticao.processo else ""
        ),
        "status": peticao.status,
        "criado_por": peticao.criado_por,
        "criado_em": isoformat_ou_nulo(peticao.criado_em),
        "atualizado_em": isoformat_ou_nulo(peticao.atualizado_em),
    }


def _rotulo_peticao(peticao: Peticao):
    return (
        " - ".join([parte for parte in (peticao.tipo, peticao.adverso) if parte])
        or str(peticao.pk)
    )


def _peticao_api_payload(request):
    payload = ler_corpo_json(request)
    data = dict(payload)
    if "cliente_id" in data and "cliente" not in data:
        data["cliente"] = data["cliente_id"]
    if "processo_id" in data and "processo" not in data:
        data["processo"] = data["processo_id"]
    if "processId" in data and "processo" not in data:
        data["processo"] = data["processId"]
    if "type" in data and "tipo" not in data:
        data["tipo"] = data["type"]
    if "responsible" in data and "responsavel_acao" not in data:
        data["responsavel_acao"] = data["responsible"]
    return data


@app_permissions_required("peticoes.view_peticao")
def listar_peticoes(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    peticoes = Peticao.objects.select_related("cliente", "processo").all()
    return resposta_sucesso(
        {"peticoes": [serialize_peticao(peticao) for peticao in peticoes]}
    )


@app_permissions_required("peticoes.add_peticao")
def criar_peticao(request):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    try:
        payload = _peticao_api_payload(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    form = PeticaoForm(payload)
    if form.is_valid():
        peticao = form.save(commit=False)
        peticao.criado_por = resolver_criador(request)
        peticao.save()
        peticao = Peticao.objects.select_related("cliente", "processo").get(
            pk=peticao.pk
        )
        auditoria_services.registrar(
            request,
            acao=RegistroAuditoria.ACAO_CRIADO,
            entidade_tipo=RegistroAuditoria.ENTIDADE_PETICAO,
            entidade_id=peticao.pk,
            rotulo=_rotulo_peticao(peticao),
            processo_id=peticao.processo_id,
            processo_rotulo=(
                peticao.processo.numero_processo if peticao.processo_id else ""
            ),
        )
        return resposta_sucesso(
            {"peticao": serialize_peticao(peticao)},
            mensagem="Peticao criada com sucesso.",
            status=201,
        )

    return resposta_erro(erros_formulario(form), status=400)


@app_permissions_required("peticoes.view_peticao")
def detalhes_peticao(request, peticao_id):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    peticao = get_object_or_404(
        Peticao.objects.select_related("cliente", "processo"), pk=peticao_id
    )
    return resposta_sucesso({"peticao": serialize_peticao(peticao)})


@app_permissions_required("peticoes.change_peticao")
def editar_peticao(request, peticao_id):
    if request.method not in {"PUT", "PATCH"}:
        return metodo_nao_permitido(["PUT", "PATCH"])

    peticao = get_object_or_404(
        Peticao.objects.select_related("cliente", "processo"), pk=peticao_id
    )
    processo_id_antigo = peticao.processo_id
    antes = serialize_peticao(peticao)

    try:
        payload = _peticao_api_payload(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    form = PeticaoForm(payload, instance=peticao)
    if form.is_valid():
        peticao = form.save()
        peticao = Peticao.objects.select_related("cliente", "processo").get(
            pk=peticao.pk
        )
        # Processo mudou: move o doc da petição para a pasta do novo processo
        # (best-effort — falha no Drive não aborta o save).
        if (
            peticao.processo_id != processo_id_antigo
            and peticao.processo_id
            and peticao.drive_file_id
        ):
            try:
                documentos_services.mover_documento_peticao(
                    current_usuario(request),
                    file_id=peticao.drive_file_id,
                    processo=peticao.processo,
                )
            except GOOGLE_ERRORS:
                pass
        serialized = serialize_peticao(peticao)
        alteracoes = auditoria_services.calcular_diff(antes, serialized)
        if alteracoes:
            auditoria_services.registrar(
                request,
                acao=RegistroAuditoria.ACAO_ATUALIZADO,
                entidade_tipo=RegistroAuditoria.ENTIDADE_PETICAO,
                entidade_id=peticao.pk,
                rotulo=_rotulo_peticao(peticao),
                alteracoes=alteracoes,
                processo_id=peticao.processo_id,
                processo_rotulo=(
                    peticao.processo.numero_processo if peticao.processo_id else ""
                ),
            )
        return resposta_sucesso(
            {"peticao": serialized},
            mensagem="Peticao atualizada com sucesso.",
        )

    return resposta_erro(erros_formulario(form), status=400)


@app_permissions_required("peticoes.change_peticao")
def documento_peticao(request, peticao_id):
    """Create (POST) or remove (DELETE) the petition's Google Doc reference.

    POST cria um Google Doc em branco na subpasta "PETIÇÕES" da pasta do processo
    e guarda ``drive_file_id``/``link_drive``. DELETE limpa a referência; com
    ``?apagar=1`` também exclui o arquivo no Drive (documento temporário).
    """
    if request.method not in {"POST", "DELETE"}:
        return metodo_nao_permitido(["POST", "DELETE"])

    peticao = get_object_or_404(
        Peticao.objects.select_related("cliente", "processo"), pk=peticao_id
    )
    usuario = current_usuario(request)
    antes = serialize_peticao(peticao)

    if request.method == "POST":
        if not peticao.processo_id:
            return resposta_erro(
                "Vincule um processo à petição antes de criar o documento.",
                status=400,
            )
        nome = (f"{peticao.tipo} - {peticao.adverso}".strip() or "Petição")[:255]
        try:
            parent_id = documentos_services.pasta_peticoes_processo(
                usuario, peticao.processo
            )
            meta = documentos_services.criar_documento_branco(
                usuario, parent_id=parent_id, nome=nome
            )
        except GOOGLE_ERRORS as exc:
            return mapear_erro_google(exc)

        peticao.drive_file_id = meta["id"]
        peticao.link_drive = meta.get("webViewLink", "") or ""
        peticao.save(update_fields=["drive_file_id", "link_drive", "atualizado_em"])
        peticao.refresh_from_db()
        serialized = serialize_peticao(peticao)
        alteracoes = auditoria_services.calcular_diff(antes, serialized)
        if alteracoes:
            auditoria_services.registrar(
                request,
                acao=RegistroAuditoria.ACAO_ATUALIZADO,
                entidade_tipo=RegistroAuditoria.ENTIDADE_PETICAO,
                entidade_id=peticao.pk,
                rotulo=_rotulo_peticao(peticao),
                alteracoes=alteracoes,
                processo_id=peticao.processo_id,
                processo_rotulo=(
                    peticao.processo.numero_processo if peticao.processo_id else ""
                ),
            )
        return resposta_sucesso(
            {"peticao": serialized},
            mensagem="Documento criado no Google Drive.",
            status=201,
        )

    # DELETE: limpa a referência (e apaga no Drive quando pedido).
    apagar = request.GET.get("apagar") == "1"
    if apagar and peticao.drive_file_id:
        try:
            documentos_services.excluir_arquivo(usuario, peticao.drive_file_id)
        except GOOGLE_ERRORS as exc:
            return mapear_erro_google(exc)

    peticao.drive_file_id = ""
    peticao.link_drive = ""
    peticao.save(update_fields=["drive_file_id", "link_drive", "atualizado_em"])
    peticao.refresh_from_db()
    serialized = serialize_peticao(peticao)
    alteracoes = auditoria_services.calcular_diff(antes, serialized)
    if alteracoes:
        auditoria_services.registrar(
            request,
            acao=RegistroAuditoria.ACAO_ATUALIZADO,
            entidade_tipo=RegistroAuditoria.ENTIDADE_PETICAO,
            entidade_id=peticao.pk,
            rotulo=_rotulo_peticao(peticao),
            alteracoes=alteracoes,
            processo_id=peticao.processo_id,
            processo_rotulo=(
                peticao.processo.numero_processo if peticao.processo_id else ""
            ),
        )
    return resposta_sucesso(
        {"peticao": serialized},
        mensagem="Documento removido da petição.",
    )


@app_permissions_required("peticoes.delete_peticao")
def excluir_peticao(request, peticao_id):
    if request.method != "DELETE":
        return metodo_nao_permitido(["DELETE"])

    peticao = get_object_or_404(
        Peticao.objects.select_related("processo"), pk=peticao_id
    )
    deleted_id = str(peticao.pk)
    rotulo = _rotulo_peticao(peticao)
    processo_id = peticao.processo_id
    processo_rotulo = peticao.processo.numero_processo if peticao.processo_id else ""
    peticao.delete()
    auditoria_services.registrar(
        request,
        acao=RegistroAuditoria.ACAO_EXCLUIDO,
        entidade_tipo=RegistroAuditoria.ENTIDADE_PETICAO,
        entidade_id=deleted_id,
        rotulo=rotulo,
        processo_id=processo_id,
        processo_rotulo=processo_rotulo,
    )
    return resposta_sucesso(
        {"id": deleted_id}, mensagem="Petição excluída com sucesso."
    )
