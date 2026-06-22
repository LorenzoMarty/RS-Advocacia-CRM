from io import BytesIO
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings

from ai.providers.openai_provider import OpenAIProvider
from ai.services import meetings as ai_meetings


@override_settings(
    OPENAI_API_KEY="test-key",
    OPENAI_TRANSCRIPTION_MODEL="gpt-4o-transcribe",
    OPENAI_SUMMARY_MODEL="gpt-4.1-mini",
)
class OpenAIProviderTests(SimpleTestCase):
    def test_transcribe_uses_configured_audio_model(self):
        client = MagicMock()
        client.audio.transcriptions.create.return_value = SimpleNamespace(
            text=" texto "
        )
        provider = OpenAIProvider(client=client)

        text = provider.transcribe(
            audio_file=BytesIO(b"audio"),
            filename="reuniao.webm",
            content_type="audio/webm",
        )

        self.assertEqual(text, "texto")
        self.assertEqual(
            client.audio.transcriptions.create.call_args.kwargs["model"],
            "gpt-4o-transcribe",
        )

    def test_summary_disables_remote_storage(self):
        client = MagicMock()
        client.responses.create.return_value = SimpleNamespace(output_text=" resumo ")
        provider = OpenAIProvider(client=client)

        summary = provider.summarize("Transcricao")

        self.assertEqual(summary, "resumo")
        kwargs = client.responses.create.call_args.kwargs
        self.assertEqual(kwargs["model"], "gpt-4.1-mini")
        self.assertFalse(kwargs["store"])

    def test_transcribe_passes_contexto_anterior_in_prompt(self):
        client = MagicMock()
        client.audio.transcriptions.create.return_value = SimpleNamespace(text="seg2")
        provider = OpenAIProvider(client=client)

        provider.transcribe(
            audio_file=BytesIO(b"audio"),
            filename="seg.webm",
            content_type="audio/webm",
            contexto_anterior="contexto anterior",
        )

        prompt_used = client.audio.transcriptions.create.call_args.kwargs["prompt"]
        self.assertIn("contexto anterior", prompt_used)

    def test_refine_summary_disables_remote_storage(self):
        client = MagicMock()
        client.responses.create.return_value = SimpleNamespace(output_text=" resumo atualizado ")
        provider = OpenAIProvider(client=client)

        result = provider.refine_summary("relatório atual", "novo trecho")

        self.assertEqual(result, "resumo atualizado")
        kwargs = client.responses.create.call_args.kwargs
        self.assertFalse(kwargs["store"])
        self.assertIn("relatório atual", kwargs["input"])
        self.assertIn("novo trecho", kwargs["input"])

    def test_refine_summary_handles_empty_current_report(self):
        client = MagicMock()
        client.responses.create.return_value = SimpleNamespace(output_text="primeiro resumo")
        provider = OpenAIProvider(client=client)

        result = provider.refine_summary("", "trecho inicial")

        self.assertEqual(result, "primeiro resumo")
        kwargs = client.responses.create.call_args.kwargs
        self.assertIn("(vazio)", kwargs["input"])


@override_settings(
    OPENAI_API_KEY="test-key",
    OPENAI_TRANSCRIPTION_MODEL="gpt-4o-transcribe",
    OPENAI_SUMMARY_MODEL="gpt-4.1-mini",
)
class AIServiceTests(SimpleTestCase):
    def _make_provider(self):
        client = MagicMock()
        return OpenAIProvider(client=client), client

    def test_transcribe_audio_delegates_to_provider(self):
        provider, client = self._make_provider()
        client.audio.transcriptions.create.return_value = SimpleNamespace(text="transcrito")

        with patch("ai.services.meetings.get_provider", return_value=provider):
            result = ai_meetings.transcribe_audio(
                BytesIO(b"audio"), filename="r.webm", content_type="audio/webm"
            )

        self.assertEqual(result, "transcrito")

    def test_summarize_transcript_delegates_to_provider(self):
        provider, client = self._make_provider()
        client.responses.create.return_value = SimpleNamespace(output_text="resumo")

        with patch("ai.services.meetings.get_provider", return_value=provider):
            result = ai_meetings.summarize_transcript("Transcrição longa...")

        self.assertEqual(result, "resumo")

    def test_refine_summary_delegates_to_provider(self):
        provider, client = self._make_provider()
        client.responses.create.return_value = SimpleNamespace(output_text="atualizado")

        with patch("ai.services.meetings.get_provider", return_value=provider):
            result = ai_meetings.refine_summary("relatório", "trecho")

        self.assertEqual(result, "atualizado")
