import json

from ai.providers import get_provider


class RespostaIAInvalida(Exception):
    """The model returned something that is not the expected JSON object."""


def serializar_arvore_para_ia(arvore: dict) -> str:
    """Render the scanned Drive tree as indented text (cheaper than JSON).

    ``arvore`` is the node format produced by ``documentos.importacao.escanear_arvore``:
    ``{"id", "nome", "arquivos": [...], "subpastas": [...]}``.
    """
    linhas: list[str] = []

    def _walk(no: dict, nivel: int) -> None:
        indent = "  " * nivel
        linhas.append(f"{indent}pasta [{no['id']}]: {no['nome']}")
        for arquivo in no.get("arquivos", []):
            mime = (arquivo.get("mime_type") or "").rsplit("/", 1)[-1]
            sufixo = f" ({mime})" if mime else ""
            linhas.append(
                f"{indent}  arquivo [{arquivo['id']}]: {arquivo['nome']}{sufixo}"
            )
        for subpasta in no.get("subpastas", []):
            _walk(subpasta, nivel + 1)

    _walk(arvore, 0)
    return "\n".join(linhas)


def _parse_json(texto: str) -> dict:
    candidato = (texto or "").strip()
    if candidato.startswith("```"):
        candidato = candidato.strip("`")
        if candidato.startswith("json"):
            candidato = candidato[4:]
        candidato = candidato.strip()
    try:
        dados = json.loads(candidato)
    except (TypeError, ValueError) as exc:
        raise RespostaIAInvalida("Resposta da IA não é JSON válido.") from exc
    if not isinstance(dados, dict):
        raise RespostaIAInvalida("Resposta da IA não é um objeto JSON.")
    return dados


def classificar_arvore(arvore: dict, contexto_cliente: str) -> dict:
    resposta = get_provider().classify_drive_tree(
        arvore_texto=serializar_arvore_para_ia(arvore),
        contexto=contexto_cliente,
    )
    return _parse_json(resposta)


def sugerir_organizacao(arvore: dict, contexto_cliente: str) -> dict:
    resposta = get_provider().plan_drive_organization(
        arvore_texto=serializar_arvore_para_ia(arvore),
        contexto=contexto_cliente,
    )
    return _parse_json(resposta)
