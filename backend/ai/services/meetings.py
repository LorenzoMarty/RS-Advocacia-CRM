from ai.providers import get_provider


def transcribe_audio(
    audio_file, *, filename: str, content_type: str, contexto_anterior: str = ""
) -> str:
    """Transcribe an opened binary audio stream.

    The caller owns the file-like object (local FileField, BytesIO from Drive,
    ...); this layer never knows where the bytes came from. ``contexto_anterior``
    is the tail of the previous segment's transcript, used to keep continuity
    across 5-minute chunk seams.
    """
    return get_provider().transcribe(
        audio_file=audio_file,
        filename=filename,
        content_type=content_type,
        contexto_anterior=contexto_anterior,
    )


def summarize_transcript(transcript: str) -> str:
    return get_provider().summarize(transcript)


def refine_summary(resumo_atual: str, novo_trecho: str) -> str:
    """Update a running meeting report with a newly transcribed segment.

    Keeps the model's context bounded (current report + one chunk) instead of
    re-summarizing the whole transcript, so meeting length is unlimited.
    """
    return get_provider().refine_summary(resumo_atual, novo_trecho)
