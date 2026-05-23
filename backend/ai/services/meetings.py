from ai.providers import get_provider


def transcribe_recording(recording) -> str:
    provider = get_provider()
    recording.arquivo_audio.open("rb")
    try:
        return provider.transcribe(
            audio_file=recording.arquivo_audio.file,
            filename=recording.nome_original,
            content_type=recording.mime_type,
        )
    finally:
        recording.arquivo_audio.close()


def summarize_transcript(transcript: str) -> str:
    return get_provider().summarize(transcript)

