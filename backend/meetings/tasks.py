import io
import logging

from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from ai.services.meetings import refine_summary, transcribe_audio
from integrations.google.exceptions import GoogleApiError, GoogleAuthorizationRequired
from meetings.models import Gravacao, Reuniao
from meetings.services import baixar_audio_drive

logger = logging.getLogger(__name__)

# A 20-minute recording takes a few minutes to transcribe + summarize; bound the
# task so a hung provider call cannot pin a worker slot forever.
SOFT_TIME_LIMIT_SECONDS = 600
TIME_LIMIT_SECONDS = 660

MENSAGEM_GOOGLE_DESCONECTADO = (
    "Conta Google de quem enviou a gravacao esta desconectada. "
    "Reconecte o Google em Integracoes e reenvie o audio."
)
MENSAGEM_TIMEOUT = (
    "Processamento excedeu o tempo limite do worker. "
    "Tente um audio mais curto ou reenvie."
)


def _falhar_gravacao(gravacao, mensagem: str) -> None:
    Gravacao.objects.filter(pk=gravacao.pk).update(
        status=Gravacao.Status.FALHOU,
        erro_processamento=mensagem[:1000],
        processada_em=timezone.now(),
    )


def _contexto_anterior(gravacao) -> str:
    """Tail of the previous segment's transcript, to seed this transcription."""
    anterior = (
        Gravacao.objects.filter(reuniao_id=gravacao.reuniao_id, ordem__lt=gravacao.ordem)
        .exclude(pk=gravacao.pk)
        .order_by("-ordem")
        .first()
    )
    return anterior.transcricao if anterior else ""


def _transcrever(gravacao, contexto_anterior: str = "") -> str:
    """Transcribe from Drive (new flow) or the legacy local file."""
    if gravacao.drive_file_id:
        audio = io.BytesIO(baixar_audio_drive(gravacao))
        return transcribe_audio(
            audio,
            filename=gravacao.nome_original,
            content_type=gravacao.mime_type,
            contexto_anterior=contexto_anterior,
        )

    gravacao.arquivo_audio.open("rb")
    try:
        return transcribe_audio(
            gravacao.arquivo_audio.file,
            filename=gravacao.nome_original,
            content_type=gravacao.mime_type,
            contexto_anterior=contexto_anterior,
        )
    finally:
        gravacao.arquivo_audio.close()


def _atualizar_resumo_reuniao(reuniao_id: int, novo_trecho: str) -> None:
    """Refine the meeting's running summary with a new segment transcript.

    Locks the meeting row so segments processed concurrently (inline mode fires
    one request per segment) cannot clobber each other's update.
    """
    if not novo_trecho.strip():
        return
    with transaction.atomic():
        reuniao = Reuniao.objects.select_for_update().get(pk=reuniao_id)
        reuniao.resumo = refine_summary(reuniao.resumo, novo_trecho)
        reuniao.save(update_fields=["resumo", "atualizado_em"])


@shared_task(
    bind=True,
    ignore_result=True,
    autoretry_for=(GoogleApiError,),
    retry_backoff=True,
    retry_backoff_max=120,
    max_retries=2,
    soft_time_limit=SOFT_TIME_LIMIT_SECONDS,
    time_limit=TIME_LIMIT_SECONDS,
)
def processar_gravacao(self, gravacao_id: int) -> None:
    try:
        gravacao = Gravacao.objects.get(pk=gravacao_id)
    except Gravacao.DoesNotExist:
        logger.warning("Gravacao %s nao encontrada para processamento.", gravacao_id)
        return

    try:
        gravacao.status = Gravacao.Status.TRANSCRIBINDO
        gravacao.processamento_iniciado_em = timezone.now()
        gravacao.erro_processamento = ""
        gravacao.modelo_transcricao = settings.OPENAI_TRANSCRIPTION_MODEL
        gravacao.modelo_resumo = settings.OPENAI_SUMMARY_MODEL
        gravacao.save(
            update_fields=[
                "status",
                "processamento_iniciado_em",
                "erro_processamento",
                "modelo_transcricao",
                "modelo_resumo",
            ]
        )

        transcricao = _transcrever(gravacao, _contexto_anterior(gravacao))
        gravacao.transcricao = transcricao
        gravacao.status = Gravacao.Status.RESUMINDO
        gravacao.save(update_fields=["transcricao", "status"])

        # Summary lives on the meeting and is refined per segment; the segment's
        # own resumo field stays empty (the report is meeting-level).
        _atualizar_resumo_reuniao(gravacao.reuniao_id, transcricao)
        gravacao.status = Gravacao.Status.CONCLUIDA
        gravacao.processada_em = timezone.now()
        gravacao.save(update_fields=["status", "processada_em"])
    except GoogleAuthorizationRequired:
        # Permanent: no usable token to download the audio; retrying won't help.
        logger.exception("Gravacao %s sem autorizacao Google.", gravacao.pk)
        _falhar_gravacao(gravacao, MENSAGEM_GOOGLE_DESCONECTADO)
        raise
    except GoogleApiError as exc:
        # Transient Drive errors are retried by autoretry_for; only mark the
        # recording as failed when no retry will follow (inline call included).
        logger.exception("Erro Drive ao processar gravacao %s.", gravacao.pk)
        if self.request.called_directly or self.request.retries >= self.max_retries:
            _falhar_gravacao(gravacao, str(exc))
        raise
    except SoftTimeLimitExceeded:
        logger.exception("Timeout ao processar gravacao %s.", gravacao.pk)
        _falhar_gravacao(gravacao, MENSAGEM_TIMEOUT)
        raise
    except Exception as exc:
        logger.exception("Falha ao processar gravacao %s.", gravacao.pk)
        _falhar_gravacao(gravacao, str(exc))
        raise
