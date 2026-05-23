from pathlib import Path

from django.conf import settings
from django.db import transaction
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
from meetings.forms import ReuniaoForm
from meetings.models import Gravacao, Reuniao
from meetings.tasks import processar_gravacao

SUPPORTED_AUDIO_EXTENSIONS = {".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm"}


def _resolver_criador(request):
    nome = (request.session.get("usuario_nome") or "").strip()
    if nome:
        return nome
    user = getattr(request, "user", None)
    full_name = getattr(user, "get_full_name", lambda: "")()
    return (full_name or getattr(user, "username", "")).strip()


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
    processo_numero = reuniao.processo.numero_processo if reuniao.processo_id else ""
    return {
        "id": str(reuniao.pk),
        "pk": reuniao.pk,
        "titulo": reuniao.titulo,
        "data_reuniao": isoformat_ou_nulo(reuniao.data_reuniao),
        "cliente_id": str(reuniao.cliente_id or ""),
        "cliente_nome": cliente_nome,
        "processo_id": str(reuniao.processo_id or ""),
        "processo_numero": processo_numero,
        "pauta": reuniao.pauta,
        "criado_por": reuniao.criado_por,
        "criado_em": isoformat_ou_nulo(reuniao.criado_em),
        "gravacoes": [serialize_gravacao(item) for item in reuniao.gravacoes.all()],
    }


@app_permissions_required("meetings.view_reuniao")
def listar_reunioes(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    reunioes = (
        Reuniao.objects.select_related("cliente", "processo")
        .prefetch_related("gravacoes")
        .all()
    )
    return resposta_sucesso({"reunioes": [serialize_reuniao(item) for item in reunioes]})


@app_permissions_required("meetings.add_reuniao")
def criar_reuniao(request):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    try:
        payload = ler_corpo_json(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    form = ReuniaoForm(payload)
    if not form.is_valid():
        return resposta_erro(erros_formulario(form), status=400)

    reuniao = form.save(commit=False)
    reuniao.criado_por = _resolver_criador(request)
    reuniao.save()
    reuniao = Reuniao.objects.select_related("cliente", "processo").get(pk=reuniao.pk)
    return resposta_sucesso(
        {"reuniao": serialize_reuniao(reuniao)},
        mensagem="Reunião criada com sucesso.",
        status=201,
    )


@app_permissions_required("meetings.view_reuniao")
def detalhes_reuniao(request, reuniao_id):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    reuniao = get_object_or_404(
        Reuniao.objects.select_related("cliente", "processo").prefetch_related("gravacoes"),
        pk=reuniao_id,
    )
    return resposta_sucesso({"reuniao": serialize_reuniao(reuniao)})


@app_permissions_required("meetings.view_gravacao")
def detalhes_gravacao(request, gravacao_id):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    gravacao = get_object_or_404(Gravacao, pk=gravacao_id)
    return resposta_sucesso({"gravacao": serialize_gravacao(gravacao)})


@app_permissions_required("meetings.add_gravacao", "meetings.view_reuniao")
def enviar_gravacao(request, reuniao_id):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    reuniao = get_object_or_404(Reuniao, pk=reuniao_id)
    arquivo = request.FILES.get("audio")
    if arquivo is None:
        return resposta_erro({"audio": ["Envie um arquivo de áudio."]}, status=400)

    extension = Path(arquivo.name).suffix.lower()
    if extension not in SUPPORTED_AUDIO_EXTENSIONS:
        formatos = ", ".join(sorted(ext.removeprefix(".") for ext in SUPPORTED_AUDIO_EXTENSIONS))
        return resposta_erro({"audio": [f"Formato inválido. Use: {formatos}."]}, status=400)

    max_bytes = settings.MEETINGS_MAX_AUDIO_SIZE_MB * 1024 * 1024
    if arquivo.size > max_bytes:
        return resposta_erro(
            {"audio": [f"O arquivo deve ter no máximo {settings.MEETINGS_MAX_AUDIO_SIZE_MB} MB."]},
            status=400,
        )

    with transaction.atomic():
        gravacao = Gravacao.objects.create(
            reuniao=reuniao,
            arquivo_audio=arquivo,
            nome_original=arquivo.name[:255],
            mime_type=arquivo.content_type or "",
            tamanho_bytes=arquivo.size,
        )
        transaction.on_commit(lambda: processar_gravacao.delay(gravacao.pk))

    return resposta_sucesso(
        {"gravacao": serialize_gravacao(gravacao)},
        mensagem="Gravação recebida e enviada para processamento.",
        status=202,
    )
