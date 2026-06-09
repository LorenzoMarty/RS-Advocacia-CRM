from io import BytesIO
from types import SimpleNamespace
from unittest.mock import MagicMock

from django.test import SimpleTestCase, override_settings

from ai.providers.openai_provider import OpenAIProvider


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
