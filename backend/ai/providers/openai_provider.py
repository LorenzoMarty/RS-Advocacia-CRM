from typing import BinaryIO

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from openai import OpenAI

from ai.models import ConfiguracaoIA
from ai.prompts.drive_import import (
    CLASSIFICACAO_ARVORE_INSTRUCTIONS,
    ORGANIZACAO_ARVORE_INSTRUCTIONS,
)
from ai.prompts.meetings import (
    SUMMARY_INSTRUCTIONS,
    SUMMARY_REFINE_INSTRUCTIONS,
    TRANSCRIPTION_PROMPT,
)

# Drive transcription accuracy across chunk seams by seeding each chunk with the
# tail of the previous transcript. Whisper/gpt-4o-transcribe cap the prompt near
# 224 tokens, so keep the carried context short.
MAX_CONTEXTO_ANTERIOR_CHARS = 600


def _usage_from_response(response, modelo: str) -> dict:
    """Best-effort token extraction — the OpenAI SDK response shape for usage
    varies by endpoint and isn't always present, so every field is optional."""
    usage = getattr(response, "usage", None)
    tokens_entrada = getattr(usage, "input_tokens", None) or getattr(
        usage, "prompt_tokens", 0
    )
    tokens_saida = getattr(usage, "output_tokens", None) or getattr(
        usage, "completion_tokens", 0
    )
    return {
        "modelo": modelo,
        "tokens_entrada": tokens_entrada or 0,
        "tokens_saida": tokens_saida or 0,
    }


class OpenAIProvider:
    def __init__(self, client=None):
        self.last_usage: dict = {}
        if client is not None:
            self.client = client
        else:
            api_key = ConfiguracaoIA.obter_api_key_ativa()
            if not api_key:
                raise ImproperlyConfigured(
                    "Cadastre a API key da OpenAI em Configurações para usar "
                    "recursos de IA."
                )
            self.client = OpenAI(api_key=api_key)

        self.transcription_model = settings.OPENAI_TRANSCRIPTION_MODEL
        self.summary_model = settings.OPENAI_SUMMARY_MODEL
        self.classification_model = settings.OPENAI_CLASSIFICATION_MODEL

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
        self.last_usage = _usage_from_response(transcription, self.transcription_model)
        return transcription.text.strip()

    def summarize(self, transcript: str) -> str:
        response = self.client.responses.create(
            model=self.summary_model,
            instructions=SUMMARY_INSTRUCTIONS,
            input=f"Transcrição da reunião:\n\n{transcript}",
            max_output_tokens=1200,
            store=False,
        )
        self.last_usage = _usage_from_response(response, self.summary_model)
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
        self.last_usage = _usage_from_response(response, self.summary_model)
        return response.output_text.strip()

    def classify_drive_tree(self, *, arvore_texto: str, contexto: str) -> str:
        response = self.client.responses.create(
            model=self.classification_model,
            instructions=CLASSIFICACAO_ARVORE_INSTRUCTIONS,
            input=(
                f"{contexto}\n\nÁRVORE DA PASTA:\n{arvore_texto}\n\n"
                "Responda apenas com o JSON no esquema definido."
            ),
            text={"format": {"type": "json_object"}},
            max_output_tokens=4000,
            store=False,
        )
        self.last_usage = _usage_from_response(response, self.classification_model)
        return response.output_text.strip()

    def plan_drive_organization(self, *, arvore_texto: str, contexto: str) -> str:
        response = self.client.responses.create(
            model=self.classification_model,
            instructions=ORGANIZACAO_ARVORE_INSTRUCTIONS,
            input=(
                f"{contexto}\n\nÁRVORE DA PASTA:\n{arvore_texto}\n\n"
                "Responda apenas com o JSON no esquema definido."
            ),
            text={"format": {"type": "json_object"}},
            max_output_tokens=4000,
            store=False,
        )
        self.last_usage = _usage_from_response(response, self.classification_model)
        return response.output_text.strip()
