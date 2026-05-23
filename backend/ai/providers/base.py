from typing import BinaryIO, Protocol


class AIProvider(Protocol):
    def transcribe(
        self,
        *,
        audio_file: BinaryIO,
        filename: str,
        content_type: str,
    ) -> str: ...

    def summarize(self, transcript: str) -> str: ...

