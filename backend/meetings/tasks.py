import logging

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from ai.services.meetings import summarize_transcript, transcribe_recording
from meetings.models import Gravacao

logger = logging.getLogger(__name__)


@shared_task(ignore_result=True)
def processar_gravacao(gravacao_id: int) -> None:
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

        transcricao = transcribe_recording(gravacao)
        gravacao.transcricao = transcricao
        gravacao.status = Gravacao.Status.RESUMINDO
        gravacao.save(update_fields=["transcricao", "status"])

        gravacao.resumo = summarize_transcript(transcricao)
        gravacao.status = Gravacao.Status.CONCLUIDA
        gravacao.processada_em = timezone.now()
        gravacao.save(update_fields=["resumo", "status", "processada_em"])
    except Exception as exc:
        logger.exception("Falha ao processar gravacao %s.", gravacao.pk)
        Gravacao.objects.filter(pk=gravacao.pk).update(
            status=Gravacao.Status.FALHOU,
            erro_processamento=str(exc)[:1000],
            processada_em=timezone.now(),
        )
        raise
