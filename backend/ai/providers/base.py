from typing import BinaryIO, Protocol


class AIProvider(Protocol):
    def transcribe(
        self,
        *,
        audio_file: BinaryIO,
        filename: str,
        content_type: str,
        contexto_anterior: str = "",
    ) -> str: ...

    def summarize(self, transcript: str) -> str: ...

    def refine_summary(self, resumo_atual: str, novo_trecho: str) -> str: ...

    def classify_drive_tree(self, *, arvore_texto: str, contexto: str) -> str: ...

    def plan_drive_organization(self, *, arvore_texto: str, contexto: str) -> str: ...
