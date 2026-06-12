from typing import BinaryIO

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from openai import OpenAI

from ai.prompts.meetings import (
    SUMMARY_INSTRUCTIONS,
    SUMMARY_REFINE_INSTRUCTIONS,
    TRANSCRIPTION_PROMPT,
)

# Drive transcription accuracy across chunk seams by seeding each chunk with the
# tail of the previous transcript. Whisper/gpt-4o-transcribe cap the prompt near
# 224 tokens, so keep the carried context short.
MAX_CONTEXTO_ANTERIOR_CHARS = 600


class OpenAIProvider:
    def __init__(self, client=None):
        api_key = getattr(settings, "OPENAI_API_KEY", "")
        if client is None and not api_key:
            raise ImproperlyConfigured(
                "Defina OPENAI_API_KEY para processar gravações."
            )

        self.client = client or OpenAI(api_key=api_key)
        self.transcription_model = settings.OPENAI_TRANSCRIPTION_MODEL
        self.summary_model = settings.OPENAI_SUMMARY_MODEL

    def transcribe(
        self,
        *,
        audio_file: BinaryIO,
        filename: str,
        content_type: str,
        contexto_anterior: str = "",
    ) -> str:
        prompt = TRANSCRIPTION_PROMPT
        if contexto_anterior:
            cauda = contexto_anterior.strip()[-MAX_CONTEXTO_ANTERIOR_CHARS:]
            prompt = f"{prompt} Continuação da fala anterior: {cauda}"
        transcription = self.client.audio.transcriptions.create(
            model=self.transcription_model,
            file=(filename, audio_file, content_type or "application/octet-stream"),
            prompt=prompt,
        )
        return transcription.text.strip()

    def summarize(self, transcript: str) -> str:
        response = self.client.responses.create(
            model=self.summary_model,
            instructions=SUMMARY_INSTRUCTIONS,
            input=f"Transcrição da reunião:\n\n{transcript}",
            max_output_tokens=1200,
            store=False,
        )
        return response.output_text.strip()

    def refine_summary(self, resumo_atual: str, novo_trecho: str) -> str:
        entrada = (
            f"RELATÓRIO ATUAL:\n\n{resumo_atual or '(vazio)'}\n\n"
            f"NOVO TRECHO DA TRANSCRIÇÃO:\n\n{novo_trecho}"
        )
        response = self.client.responses.create(
            model=self.summary_model,
            instructions=SUMMARY_REFINE_INSTRUCTIONS,
            input=entrada,
            max_output_tokens=1600,
            store=False,
        )
        return response.output_text.strip()
