from typing import BinaryIO

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from openai import OpenAI

from ai.prompts.meetings import SUMMARY_INSTRUCTIONS, TRANSCRIPTION_PROMPT


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
    ) -> str:
        transcription = self.client.audio.transcriptions.create(
            model=self.transcription_model,
            file=(filename, audio_file, content_type or "application/octet-stream"),
            prompt=TRANSCRIPTION_PROMPT,
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
