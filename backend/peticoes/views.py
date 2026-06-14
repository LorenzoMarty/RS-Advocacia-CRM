from django.shortcuts import get_object_or_404

from core.permissions import app_permissions_required
from core.utils import (
    erros_formulario,
    isoformat_ou_nulo,
    ler_corpo_json,
    metodo_nao_permitido,
    resposta_erro,
    resposta_sucesso,
)
from documentos import services as documentos_services
from integrations.google.exceptions import (
    GoogleApiError,
    GoogleAuthorizationRequired,
    GoogleConfigurationError,
)
from integrations.google.oauth import current_usuario
from integrations.google.responses import mapear_erro_google
from peticoes.forms import PeticaoForm
from peticoes.models import Peticao


def _resolver_criador_peticao(request):
    nome_sessao = (request.session.get("usuario_nome") or "").strip()
    if nome_sessao:
        return nome_sessao

    usuario_requisicao = getattr(request, "user", None)
    if usuario_requisicao and getattr(usuario_requisicao, "is_authenticated", False):
        obter_nome_completo = getattr(usuario_requisicao, "get_full_name", None)
        if callable(obter_nome_completo):
            nome_completo = obter_nome_completo().strip()
            if nome_completo:
                return nome_completo

        for atributo in ("first_name", "username", "email"):
            valor = (getattr(usuario_requisicao, atributo, "") or "").strip()
            if valor:
                return valor

    return "Interno"


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
        "area_juridica": peticao.area_juridica,
        "status": peticao.status,
        "criado_por": peticao.criado_por,
        "criado_em": isoformat_ou_nulo(peticao.criado_em),
        "atualizado_em": isoformat_ou_nulo(peticao.atualizado_em),
    }


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
        peticao.criado_por = _resolver_criador_peticao(request)
        peticao.save()
        peticao = Peticao.objects.select_related("cliente", "processo").get(
            pk=peticao.pk
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

    peticao = get_object_or_404(Peticao, pk=peticao_id)

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
        return resposta_sucesso(
            {"peticao": serialize_peticao(peticao)},
            mensagem="Peticao atualizada com sucesso.",
        )

    return resposta_erro(erros_formulario(form), status=400)


@app_permissions_required("peticoes.change_peticao")
def documento_peticao(request, peticao_id):
    """Create (POST) or remove (DELETE) the petition's Google Doc reference.

    POST cria um Google Doc em branco na pasta "Petições" do cliente e guarda
    ``drive_file_id``/``link_drive``. DELETE limpa a referência; com ``?apagar=1``
    também exclui o arquivo no Drive (documento temporário).
    """
    if request.method not in {"POST", "DELETE"}:
        return metodo_nao_permitido(["POST", "DELETE"])

    peticao = get_object_or_404(
        Peticao.objects.select_related("cliente", "processo"), pk=peticao_id
    )
    usuario = current_usuario(request)

    if request.method == "POST":
        nome = (f"{peticao.tipo} - {peticao.adverso}".strip() or "Petição")[:255]
        try:
            parent_id = documentos_services.pasta_peticoes_cliente(
                usuario, peticao.cliente
            )
            meta = documentos_services.criar_documento_branco(
                usuario, parent_id=parent_id, nome=nome
            )
        except (
            GoogleConfigurationError,
            GoogleAuthorizationRequired,
            GoogleApiError,
        ) as exc:
            return mapear_erro_google(exc)

        peticao.drive_file_id = meta["id"]
        peticao.link_drive = meta.get("webViewLink", "") or ""
        peticao.save(update_fields=["drive_file_id", "link_drive", "atualizado_em"])
        return resposta_sucesso(
            {"peticao": serialize_peticao(peticao)},
            mensagem="Documento criado no Google Drive.",
            status=201,
        )

    # DELETE: limpa a referência (e apaga no Drive quando pedido).
    apagar = request.GET.get("apagar") == "1"
    if apagar and peticao.drive_file_id:
        try:
            documentos_services.excluir_arquivo(usuario, peticao.drive_file_id)
        except (
            GoogleConfigurationError,
            GoogleAuthorizationRequired,
            GoogleApiError,
        ) as exc:
            return mapear_erro_google(exc)

    peticao.drive_file_id = ""
    peticao.link_drive = ""
    peticao.save(update_fields=["drive_file_id", "link_drive", "atualizado_em"])
    return resposta_sucesso(
        {"peticao": serialize_peticao(peticao)},
        mensagem="Documento removido da petição.",
    )


@app_permissions_required("peticoes.delete_peticao")
def excluir_peticao(request, peticao_id):
    if request.method != "DELETE":
        return metodo_nao_permitido(["DELETE"])

    peticao = get_object_or_404(Peticao, pk=peticao_id)
    deleted_id = str(peticao.pk)
    peticao.delete()
    return resposta_sucesso(
        {"id": deleted_id}, mensagem="Petição excluída com sucesso."
    )
