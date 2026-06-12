import io
import logging

from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded
from django.conf import settings
from django.utils import timezone

from ai.services.meetings import summarize_transcript, transcribe_audio
from integrations.google.exceptions import GoogleApiError, GoogleAuthorizationRequired
from meetings.models import Gravacao
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


def _transcrever(gravacao) -> str:
    """Transcribe from Drive (new flow) or the legacy local file."""
    if gravacao.drive_file_id:
        audio = io.BytesIO(baixar_audio_drive(gravacao))
        return transcribe_audio(
            audio,
            filename=gravacao.nome_original,
            content_type=gravacao.mime_type,
        )

    gravacao.arquivo_audio.open("rb")
    try:
        return transcribe_audio(
            gravacao.arquivo_audio.file,
            filename=gravacao.nome_original,
            content_type=gravacao.mime_type,
        )
    finally:
        gravacao.arquivo_audio.close()


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

        transcricao = _transcrever(gravacao)
        gravacao.transcricao = transcricao
        gravacao.status = Gravacao.Status.RESUMINDO
        gravacao.save(update_fields=["transcricao", "status"])

        gravacao.resumo = summarize_transcript(transcricao)
        gravacao.status = Gravacao.Status.CONCLUIDA
        gravacao.processada_em = timezone.now()
        gravacao.save(update_fields=["resumo", "status", "processada_em"])
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
