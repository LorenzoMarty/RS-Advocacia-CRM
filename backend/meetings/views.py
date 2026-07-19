import logging
from pathlib import Path

from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone

from core.pagination import paginar
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
from integrations.google.exceptions import GOOGLE_ERRORS
from integrations.google.oauth import current_usuario
from integrations.google.responses import mapear_erro_google
from meetings import services
from meetings.audio import (
    SUPPORTED_AUDIO_EXTENSIONS,
    extensao_audio,
    formatos_suportados,
    mime_audio_suportado,
    validar_audio_declarado,
)
from meetings.forms import ReuniaoForm
from meetings.models import Gravacao, Reuniao
from meetings.tasks import processar_gravacao

logger = logging.getLogger(__name__)

PROCESSING_MODES = {"celery", "inline"}


def _modo_processamento():
    return str(getattr(settings, "MEETINGS_PROCESSING_MODE", "celery")).strip().lower()


def _erros_configuracao_processamento():
    erros = {}
    modo = _modo_processamento()
    if not settings.OPENAI_API_KEY:
        erros["openai"] = [
            "OPENAI_API_KEY não configurada no backend. "
            "Defina a variavel de ambiente e reinicie o servidor."
        ]
    if modo not in PROCESSING_MODES:
        erros["processamento"] = [
            "MEETINGS_PROCESSING_MODE inválido. Use 'inline' sem Redis ou 'celery' com Redis."
        ]
    if modo == "celery" and not settings.CELERY_BROKER_URL:
        erros["fila"] = [
            "Redis/Celery não configurado. Defina REDIS_URL ou CELERY_BROKER_URL "
            "e mantenha um worker Celery rodando, ou use "
            "MEETINGS_PROCESSING_MODE=inline."
        ]
    return erros


def _falhar_gravacao_por_fila(gravacao, exc):
    mensagem = (
        "Não foi possível enfileirar o processamento da gravação. "
        "Verifique Redis/Celery worker."
    )
    gravacao.status = Gravacao.Status.FALHOU
    gravacao.erro_processamento = f"{mensagem} {exc}"[:1000]
    gravacao.processada_em = timezone.now()
    gravacao.save(update_fields=["status", "erro_processamento", "processada_em"])
    return mensagem


def _resposta_falha_processamento_inline(gravacao, exc):
    gravacao.refresh_from_db()
    mensagem = (
        "Não foi possível transcrever/resumir a gravação nesta requisição. "
        "Verifique OPENAI_API_KEY e tamanho do audio."
    )
    logger.exception("Falha ao processar gravacao %s em modo inline.", gravacao.pk)
    return resposta_erro(
        {
            "processamento": [mensagem],
            "gravacao": [str(gravacao.pk)],
            "erro": [str(exc)[:300]],
        },
        status=502,
    )


def _ordem_int(valor) -> int:
    """Parse a segment index from request data; clamps to >= 0."""
    try:
        return max(0, int(valor))
    except (TypeError, ValueError):
        return 0


def _primeiro_arquivo_audio(request):
    arquivo = request.FILES.get("audio")
    if arquivo is not None:
        return arquivo
    if request.FILES:
        return next(iter(request.FILES.values()))
    return None


def _extensao_arquivo_audio(arquivo):
    return extensao_audio(
        arquivo.name or "", getattr(arquivo, "content_type", "") or ""
    )


def _mime_audio_suportado(arquivo):
    return mime_audio_suportado(getattr(arquivo, "content_type", "") or "")


def serialize_gravacao(gravacao: Gravacao):
    return {
        "id": str(gravacao.pk),
        "pk": gravacao.pk,
        "ordem": gravacao.ordem,
        "drive_file_id": gravacao.drive_file_id,
        "nome_original": gravacao.nome_original,
        "mime_type": gravacao.mime_type,
        "tamanho_bytes": gravacao.tamanho_bytes,
        "status": gravacao.status,
        "status_label": gravacao.get_status_display(),
        "transcricao": gravacao.transcricao,
        "resumo": gravacao.resumo,
        "provedor": gravacao.provedor,
        "modelo_transcricao": gravacao.modelo_transcricao,
        "modelo_resumo": gravacao.modelo_resumo,
        "erro_processamento": gravacao.erro_processamento,
        "criada_em": isoformat_ou_nulo(gravacao.criada_em),
        "processada_em": isoformat_ou_nulo(gravacao.processada_em),
    }


def serialize_reuniao(reuniao: Reuniao):
    cliente_nome = reuniao.cliente.nome if reuniao.cliente else ""
    # Segments in capture order; the full transcript is their concatenation.
    gravacoes = sorted(reuniao.gravacoes.all(), key=lambda g: (g.ordem, g.pk))
    transcricao = "\n\n".join(g.transcricao for g in gravacoes if g.transcricao)
    return {
        "id": str(reuniao.pk),
        "pk": reuniao.pk,
        "titulo": reuniao.titulo,
        "data_reuniao": isoformat_ou_nulo(reuniao.data_reuniao),
        "cliente_id": str(reuniao.cliente_id or ""),
        "cliente_nome": cliente_nome,
        "criado_por": reuniao.criado_por,
        "criado_em": isoformat_ou_nulo(reuniao.criado_em),
        "resumo": reuniao.resumo,
        "transcricao": transcricao,
        "documento_drive_id": reuniao.documento_drive_id,
        "documento_link": reuniao.documento_link,
        "documento_gerado_em": isoformat_ou_nulo(reuniao.documento_gerado_em),
        "gravacoes": [serialize_gravacao(item) for item in gravacoes],
    }


def _reuniao_api_payload(request):
    payload = ler_corpo_json(request)
    data = dict(payload)
    if "clientId" in data and "cliente" not in data:
        data["cliente"] = data["clientId"]
    if "title" in data and "titulo" not in data:
        data["titulo"] = data["title"]
    if "meetingAt" in data and "data_reuniao" not in data:
        data["data_reuniao"] = data["meetingAt"]
    return data


def _apagar_audio_gravacao(gravacao):
    """Best-effort removal of the recording's audio (Drive or legacy file)."""
    if gravacao.drive_file_id:
        services.excluir_audio_drive(gravacao)

    if not gravacao.arquivo_audio:
        return

    try:
        gravacao.arquivo_audio.delete(save=False)
    except Exception:
        logger.exception("Falha ao apagar arquivo da gravacao %s.", gravacao.pk)


@app_permissions_required("meetings.view_reuniao")
def listar_reunioes(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    reunioes = (
        Reuniao.objects.select_related("cliente").prefetch_related("gravacoes").all()
    )
    # Limite alto (não paginação de UI): frontend carrega tudo no store
    # global — isto é só um teto de segurança.
    pagina, paginacao = paginar(reunioes, request, limite_padrao=1000, limite_maximo=5000)
    return resposta_sucesso(
        {
            "reunioes": [serialize_reuniao(item) for item in pagina],
            "paginacao": paginacao,
        }
    )


@app_permissions_required("meetings.add_reuniao")
def criar_reuniao(request):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    try:
        payload = _reuniao_api_payload(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    form = ReuniaoForm(payload)
    if not form.is_valid():
        return resposta_erro(erros_formulario(form), status=400)

    reuniao = form.save(commit=False)
    reuniao.criado_por = resolver_criador(request)
    reuniao.save()
    reuniao = Reuniao.objects.select_related("cliente").get(pk=reuniao.pk)
    return resposta_sucesso(
        {"reuniao": serialize_reuniao(reuniao)},
        mensagem="Reunião criada com sucesso.",
        status=201,
    )


@app_permissions_required("meetings.change_reuniao")
def editar_reuniao(request, reuniao_id):
    if request.method not in {"PUT", "PATCH"}:
        return metodo_nao_permitido(["PUT", "PATCH"])

    reuniao = get_object_or_404(Reuniao, pk=reuniao_id)

    try:
        payload = _reuniao_api_payload(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    form = ReuniaoForm(payload, instance=reuniao)
    if not form.is_valid():
        return resposta_erro(erros_formulario(form), status=400)

    reuniao = form.save()
    reuniao = (
        Reuniao.objects.select_related("cliente")
        .prefetch_related("gravacoes")
        .get(pk=reuniao.pk)
    )
    return resposta_sucesso(
        {"reuniao": serialize_reuniao(reuniao)},
        mensagem="Reuniao atualizada com sucesso.",
    )


@app_permissions_required("meetings.delete_reuniao")
def excluir_reuniao(request, reuniao_id):
    if request.method != "DELETE":
        return metodo_nao_permitido(["DELETE"])

    reuniao = get_object_or_404(
        Reuniao.objects.prefetch_related("gravacoes"), pk=reuniao_id
    )
    deleted_id = str(reuniao.pk)
    for gravacao in reuniao.gravacoes.all():
        _apagar_audio_gravacao(gravacao)
    reuniao.delete()
    return resposta_sucesso(
        {"id": deleted_id}, mensagem="Reunião excluída com sucesso."
    )


@app_permissions_required("meetings.change_reuniao", "meetings.view_reuniao")
def finalizar_reuniao(request, reuniao_id):
    """Generate the meeting document on Drive (and delete audio when enabled)."""
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    reuniao = get_object_or_404(
        Reuniao.objects.select_related("cliente").prefetch_related("gravacoes"),
        pk=reuniao_id,
    )

    usuario = current_usuario(request)
    if usuario is None:
        return resposta_erro("Sessao expirada. Entre novamente.", status=401)

    try:
        resultado = services.finalizar_reuniao(usuario, reuniao)
    except ValueError as exc:
        return resposta_erro({"reuniao": [str(exc)]}, status=400)
    except GOOGLE_ERRORS as exc:
        return mapear_erro_google(exc)

    reuniao = (
        Reuniao.objects.select_related("cliente")
        .prefetch_related("gravacoes")
        .get(pk=reuniao.pk)
    )
    mensagem = "Documento da reunião salvo no Drive."
    if resultado["audios_apagados"]:
        mensagem = (
            f"Documento salvo no Drive e {resultado['audios_apagados']} áudio(s) "
            "removido(s)."
        )
    return resposta_sucesso(
        {"reuniao": serialize_reuniao(reuniao), "resultado": resultado},
        mensagem=mensagem,
    )


@app_permissions_required("meetings.view_reuniao")
def detalhes_reuniao(request, reuniao_id):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    reuniao = get_object_or_404(
        Reuniao.objects.select_related("cliente").prefetch_related("gravacoes"),
        pk=reuniao_id,
    )
    return resposta_sucesso({"reuniao": serialize_reuniao(reuniao)})


@app_permissions_required("meetings.view_gravacao")
def detalhes_gravacao(request, gravacao_id):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    gravacao = get_object_or_404(Gravacao, pk=gravacao_id)
    return resposta_sucesso({"gravacao": serialize_gravacao(gravacao)})


@app_permissions_required("meetings.change_gravacao")
def editar_gravacao(request, gravacao_id):
    if request.method not in {"PUT", "PATCH"}:
        return metodo_nao_permitido(["PUT", "PATCH"])

    gravacao = get_object_or_404(Gravacao, pk=gravacao_id)

    try:
        payload = ler_corpo_json(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    update_fields = []
    if "transcricao" in payload or "transcript" in payload:
        gravacao.transcricao = str(
            payload.get("transcricao", payload.get("transcript", ""))
        ).strip()
        update_fields.append("transcricao")
    if "resumo" in payload or "summary" in payload:
        gravacao.resumo = str(payload.get("resumo", payload.get("summary", ""))).strip()
        update_fields.append("resumo")

    if not update_fields:
        return resposta_erro(
            {"gravacao": ["Informe transcricao ou resumo para atualizar."]},
            status=400,
        )

    gravacao.save(update_fields=update_fields)
    return resposta_sucesso(
        {"gravacao": serialize_gravacao(gravacao)},
        mensagem="Gravacao atualizada com sucesso.",
    )


@app_permissions_required("meetings.delete_gravacao")
def excluir_gravacao(request, gravacao_id):
    if request.method != "DELETE":
        return metodo_nao_permitido(["DELETE"])

    gravacao = get_object_or_404(Gravacao, pk=gravacao_id)
    deleted_id = str(gravacao.pk)
    _apagar_audio_gravacao(gravacao)
    gravacao.delete()
    return resposta_sucesso(
        {"id": deleted_id}, mensagem="Gravação excluída com sucesso."
    )


@app_permissions_required("meetings.add_gravacao", "meetings.view_reuniao")
def enviar_gravacao(request, reuniao_id):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    erros_configuracao = _erros_configuracao_processamento()
    if erros_configuracao:
        return resposta_erro(erros_configuracao, status=503)

    reuniao = get_object_or_404(Reuniao, pk=reuniao_id)
    arquivo = _primeiro_arquivo_audio(request)
    if arquivo is None:
        logger.warning(
            "Upload de gravacao sem arquivo. content_type=%s content_length=%s files=%s post=%s",
            request.META.get("CONTENT_TYPE", ""),
            request.META.get("CONTENT_LENGTH", ""),
            list(request.FILES.keys()),
            list(request.POST.keys()),
        )
        return resposta_erro({"audio": ["Envie um arquivo de áudio."]}, status=400)

    extension = _extensao_arquivo_audio(arquivo)
    if extension not in SUPPORTED_AUDIO_EXTENSIONS and not _mime_audio_suportado(
        arquivo
    ):
        logger.warning(
            "Formato de gravacao rejeitado. name=%s content_type=%s size=%s extension=%s",
            arquivo.name,
            arquivo.content_type,
            arquivo.size,
            extension,
        )
        return resposta_erro(
            {"audio": [f"Formato inválido. Use: {formatos_suportados()}."]}, status=400
        )

    max_bytes = settings.MEETINGS_MAX_AUDIO_SIZE_MB * 1024 * 1024
    if arquivo.size > max_bytes:
        logger.warning(
            "Gravacao rejeitada por tamanho. name=%s size=%s max_bytes=%s",
            arquivo.name,
            arquivo.size,
            max_bytes,
        )
        return resposta_erro(
            {
                "audio": [
                    f"O arquivo deve ter no máximo {settings.MEETINGS_MAX_AUDIO_SIZE_MB} MB."
                ]
            },
            status=400,
        )

    if not Path(arquivo.name or "").suffix and extension:
        arquivo.name = f"reuniao{extension}"

    gravacao = Gravacao.objects.create(
        reuniao=reuniao,
        arquivo_audio=arquivo,
        nome_original=arquivo.name[:255],
        mime_type=arquivo.content_type or "",
        tamanho_bytes=arquivo.size,
        ordem=_ordem_int(request.POST.get("ordem")),
    )

    return _processar_ou_enfileirar(gravacao)


def _processar_ou_enfileirar(gravacao):
    """Run the processing inline or enqueue it, returning the JSON response."""
    modo = _modo_processamento()
    try:
        if modo == "inline":
            processar_gravacao(gravacao.pk)
            gravacao.refresh_from_db()
            return resposta_sucesso(
                {"gravacao": serialize_gravacao(gravacao)},
                mensagem="Gravacao processada com transcricao e resumo.",
                status=201,
            )

        processar_gravacao.delay(gravacao.pk)
    except Exception as exc:
        if modo == "inline":
            return _resposta_falha_processamento_inline(gravacao, exc)

        logger.exception("Falha ao enfileirar gravacao %s.", gravacao.pk)
        mensagem = _falhar_gravacao_por_fila(gravacao, exc)
        return resposta_erro(
            {
                "fila": [mensagem],
                "gravacao": [str(gravacao.pk)],
            },
            status=503,
        )

    return resposta_sucesso(
        {"gravacao": serialize_gravacao(gravacao)},
        mensagem="Gravação recebida e enviada para processamento.",
        status=202,
    )


@app_permissions_required("meetings.add_gravacao", "meetings.view_reuniao")
def criar_sessao_upload_gravacao(request, reuniao_id):
    """Open a Drive resumable session so the browser uploads straight to Google.

    Audio is sent directly from the browser to Drive for efficiency; only this
    session handshake travels through the backend.
    """
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    erros_configuracao = _erros_configuracao_processamento()
    if erros_configuracao:
        return resposta_erro(erros_configuracao, status=503)

    reuniao = get_object_or_404(
        Reuniao.objects.select_related("cliente"), pk=reuniao_id
    )

    try:
        payload = ler_corpo_json(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    nome = str(payload.get("nome_arquivo") or "").strip()
    mime_type = str(payload.get("mime_type") or "").strip()
    try:
        tamanho_bytes = int(payload.get("tamanho_bytes") or 0)
    except (TypeError, ValueError):
        tamanho_bytes = 0

    erros = validar_audio_declarado(nome, mime_type, tamanho_bytes)
    if erros:
        return resposta_erro(erros, status=400)

    usuario = current_usuario(request)
    if usuario is None:
        return resposta_erro("Sessao expirada. Entre novamente.", status=401)

    try:
        sessao = services.criar_sessao_upload(
            usuario,
            reuniao,
            nome=nome,
            mime_type=mime_type,
            tamanho_bytes=tamanho_bytes,
        )
    except GOOGLE_ERRORS as exc:
        return mapear_erro_google(exc)

    return resposta_sucesso(sessao)


@app_permissions_required("meetings.add_gravacao", "meetings.view_reuniao")
def confirmar_gravacao(request, reuniao_id):
    """Register a recording the browser finished uploading to Drive."""
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    erros_configuracao = _erros_configuracao_processamento()
    if erros_configuracao:
        return resposta_erro(erros_configuracao, status=503)

    reuniao = get_object_or_404(
        Reuniao.objects.select_related("cliente"), pk=reuniao_id
    )

    try:
        payload = ler_corpo_json(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    drive_file_id = str(payload.get("drive_file_id") or "").strip()
    if not drive_file_id:
        return resposta_erro(
            {"drive_file_id": ["Informe o arquivo enviado."]}, status=400
        )

    usuario = current_usuario(request)
    if usuario is None:
        return resposta_erro("Sessao expirada. Entre novamente.", status=401)

    try:
        gravacao = services.confirmar_upload(
            usuario,
            reuniao,
            drive_file_id=drive_file_id,
            nome_original=str(payload.get("nome_original") or "").strip(),
            mime_type=str(payload.get("mime_type") or "").strip(),
            ordem=_ordem_int(payload.get("ordem")),
        )
    except ValueError as exc:
        return resposta_erro({"audio": [str(exc)]}, status=400)
    except GOOGLE_ERRORS as exc:
        return mapear_erro_google(exc)

    return _processar_ou_enfileirar(gravacao)
