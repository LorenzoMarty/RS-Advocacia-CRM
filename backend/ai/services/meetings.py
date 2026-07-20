from ai.models import UsoIA
from ai.providers import get_provider
from ai.services.usage import registrar_uso_seguro


def transcribe_audio(
    audio_file, *, filename: str, content_type: str, contexto_anterior: str = ""
) -> str:
    """Transcribe an opened binary audio stream.

    The caller owns the file-like object (local FileField, BytesIO from Drive,
    ...); this layer never knows where the bytes came from. ``contexto_anterior``
    is the tail of the previous segment's transcript, used to keep continuity
    across 5-minute chunk seams.
    """
    provider = get_provider()
    texto = provider.transcribe(
        audio_file=audio_file,
        filename=filename,
        content_type=content_type,
        contexto_anterior=contexto_anterior,
    )
    registrar_uso_seguro(UsoIA.OPERACAO_TRANSCRICAO, provider)
    return texto


def summarize_transcript(transcript: str) -> str:
    provider = get_provider()
    resumo = provider.summarize(transcript)
    registrar_uso_seguro(UsoIA.OPERACAO_RESUMO, provider)
    return resumo


def refine_summary(resumo_atual: str, novo_trecho: str) -> str:
    """Update a running meeting report with a newly transcribed segment.

    Keeps the model's context bounded (current report + one chunk) instead of
    re-summarizing the whole transcript, so meeting length is unlimited.
    """
    provider = get_provider()
    resumo = provider.refine_summary(resumo_atual, novo_trecho)
    registrar_uso_seguro(UsoIA.OPERACAO_REFINE, provider)
    return resumo
