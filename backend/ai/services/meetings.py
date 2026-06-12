from ai.providers import get_provider


def transcribe_audio(audio_file, *, filename: str, content_type: str) -> str:
    """Transcribe an opened binary audio stream.

    The caller owns the file-like object (local FileField, BytesIO from Drive,
    ...); this layer never knows where the bytes came from.
    """
    return get_provider().transcribe(
        audio_file=audio_file,
        filename=filename,
        content_type=content_type,
    )


def summarize_transcript(transcript: str) -> str:
    return get_provider().summarize(transcript)
