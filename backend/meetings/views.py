import logging
import mimetypes
from pathlib import Path

from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone

from core.permissions import app_permissions_required
from core.utils import (
    erros_formulario,
    isoformat_ou_nulo,
    ler_corpo_json,
    metodo_nao_permitido,
    resposta_erro,
    resposta_sucesso,
)
from meetings.forms import ReuniaoForm
from meetings.models import Gravacao, Reuniao
from meetings.tasks import processar_gravacao

logger = logging.getLogger(__name__)

SUPPORTED_AUDIO_EXTENSIONS = {
    ".flac",
    ".mp3",
    ".mp4",
    ".mpeg",
    ".mpga",
    ".m4a",
    ".ogg",
    ".wav",
    ".webm",
}
SUPPORTED_AUDIO_MIME_PREFIXES = ("audio/",)
SUPPORTED_AUDIO_MIME_TYPES = {
    "application/ogg",
    "video/mp4",
    "video/webm",
}
MIME_EXTENSION_FALLBACKS = {
    "audio/mp4": ".mp4",
    "audio/mpeg": ".mp3",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "audio/webm": ".webm",
    "application/ogg": ".ogg",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
}
PROCESSING_MODES = {"celery", "inline"}


def _modo_processamento():
    return str(getattr(settings, "MEETINGS_PROCESSING_MODE", "celery")).strip().lower()


def _erros_configuracao_processamento():
    erros = {}
    modo = _modo_processamento()
    if not settings.OPENAI_API_KEY:
        erros["openai"] = [
            "OPENAI_API_KEY nao configurada no backend. "
            "Defina a variavel na Vercel e faca novo deploy."
        ]
    if modo not in PROCESSING_MODES:
        erros["processamento"] = [
            "MEETINGS_PROCESSING_MODE invalido. Use 'inline' sem Redis ou 'celery' com Redis."
        ]
    if modo == "celery" and not settings.CELERY_BROKER_URL:
        erros["fila"] = [
            "Redis/Celery nao configurado. Defina REDIS_URL ou CELERY_BROKER_URL "
            "e mantenha um worker Celery rodando fora da Vercel, ou use "
            "MEETINGS_PROCESSING_MODE=inline."
        ]
    return erros


def _falhar_gravacao_por_fila(gravacao, exc):
    mensagem = (
        "Nao foi possivel enfileirar o processamento da gravacao. "
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
        "Nao foi possivel transcrever/resumir a gravacao nesta requisicao. "
        "Verifique OPENAI_API_KEY, tamanho do audio e limite de execucao da Vercel."
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


def _resolver_criador(request):
    nome = (request.session.get("usuario_nome") or "").strip()
    if nome:
        return nome
    user = getattr(request, "user", None)
    full_name = getattr(user, "get_full_name", lambda: "")()
    return (full_name or getattr(user, "username", "")).strip()


def _primeiro_arquivo_audio(request):
    arquivo = request.FILES.get("audio")
    if arquivo is not None:
        return arquivo
    if request.FILES:
        return next(iter(request.FILES.values()))
    return None


def _extensao_arquivo_audio(arquivo):
    extension = Path(arquivo.name or "").suffix.lower()
    if extension:
        return extension

    content_type = (getattr(arquivo, "content_type", "") or "").split(";")[0].lower()
    guessed = MIME_EXTENSION_FALLBACKS.get(content_type) or mimetypes.guess_extension(content_type)
    return (guessed or "").lower()


def _mime_audio_suportado(arquivo):
    content_type = (getattr(arquivo, "content_type", "") or "").split(";")[0].lower()
    return content_type.startswith(SUPPORTED_AUDIO_MIME_PREFIXES) or content_type in SUPPORTED_AUDIO_MIME_TYPES


def serialize_gravacao(gravacao):
    return {
        "id": str(gravacao.pk),
        "pk": gravacao.pk,
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


def serialize_reuniao(reuniao):
    cliente_nome = reuniao.cliente.nome if reuniao.cliente_id else ""
    return {
        "id": str(reuniao.pk),
        "pk": reuniao.pk,
        "titulo": reuniao.titulo,
        "data_reuniao": isoformat_ou_nulo(reuniao.data_reuniao),
        "cliente_id": str(reuniao.cliente_id or ""),
        "cliente_nome": cliente_nome,
        "criado_por": reuniao.criado_por,
        "criado_em": isoformat_ou_nulo(reuniao.criado_em),
        "gravacoes": [serialize_gravacao(item) for item in reuniao.gravacoes.all()],
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


def _apagar_arquivo_gravacao(gravacao):
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
        Reuniao.objects.select_related("cliente")
        .prefetch_related("gravacoes")
        .all()
    )
    return resposta_sucesso({"reunioes": [serialize_reuniao(item) for item in reunioes]})


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
    reuniao.criado_por = _resolver_criador(request)
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

    reuniao = get_object_or_404(Reuniao.objects.prefetch_related("gravacoes"), pk=reuniao_id)
    deleted_id = str(reuniao.pk)
    for gravacao in reuniao.gravacoes.all():
        _apagar_arquivo_gravacao(gravacao)
    reuniao.delete()
    return resposta_sucesso({"id": deleted_id}, mensagem="Reuniao excluida com sucesso.")


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
        gravacao.transcricao = str(payload.get("transcricao", payload.get("transcript", ""))).strip()
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
    _apagar_arquivo_gravacao(gravacao)
    gravacao.delete()
    return resposta_sucesso({"id": deleted_id}, mensagem="Gravacao excluida com sucesso.")


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
    if extension not in SUPPORTED_AUDIO_EXTENSIONS and not _mime_audio_suportado(arquivo):
        logger.warning(
            "Formato de gravacao rejeitado. name=%s content_type=%s size=%s extension=%s",
            arquivo.name,
            arquivo.content_type,
            arquivo.size,
            extension,
        )
        formatos = ", ".join(sorted(ext.removeprefix(".") for ext in SUPPORTED_AUDIO_EXTENSIONS))
        return resposta_erro({"audio": [f"Formato inválido. Use: {formatos}."]}, status=400)

    max_bytes = settings.MEETINGS_MAX_AUDIO_SIZE_MB * 1024 * 1024
    if arquivo.size > max_bytes:
        logger.warning(
            "Gravacao rejeitada por tamanho. name=%s size=%s max_bytes=%s",
            arquivo.name,
            arquivo.size,
            max_bytes,
        )
        return resposta_erro(
            {"audio": [f"O arquivo deve ter no máximo {settings.MEETINGS_MAX_AUDIO_SIZE_MB} MB."]},
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
    )

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
