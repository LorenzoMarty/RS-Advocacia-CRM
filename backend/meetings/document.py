"""HTML builder for the meeting document saved to Google Drive.

Pure functions: turn a meeting's summary + transcript into an HTML body that
Drive converts into a native Google Doc (see
``integrations.google.drive.create_google_doc``). Kept dependency-free.
"""

from __future__ import annotations

import html


def _esc(value: object) -> str:
    return html.escape(str(value or ""))


def _format_datetime(value) -> str:
    if not value:
        return "Sem data definida"
    try:
        return value.strftime("%d/%m/%Y %H:%M")
    except AttributeError:
        return _esc(value)


def _render_markdownish(text: str) -> str:
    """Render the running summary (light markdown) into HTML.

    Supports ``##``/``###`` headings and ``-``/``*`` bullet lists; everything
    else becomes a paragraph. Good enough for the AI summary format without a
    markdown dependency.
    """
    lines = (text or "").splitlines()
    blocks: list[str] = []
    bullets: list[str] = []

    def flush_bullets() -> None:
        if bullets:
            items = "".join(f"<li>{_esc(item)}</li>" for item in bullets)
            blocks.append(f"<ul>{items}</ul>")
            bullets.clear()

    for raw in lines:
        line = raw.strip()
        if not line:
            flush_bullets()
            continue
        if line.startswith("### "):
            flush_bullets()
            blocks.append(f"<h3>{_esc(line[4:])}</h3>")
        elif line.startswith("## "):
            flush_bullets()
            blocks.append(f"<h2>{_esc(line[3:])}</h2>")
        elif line.startswith(("- ", "* ")):
            bullets.append(line[2:])
        else:
            flush_bullets()
            blocks.append(f"<p>{_esc(line)}</p>")

    flush_bullets()
    return "".join(blocks) or "<p>—</p>"


def _render_paragraphs(text: str) -> str:
    blocks = [block.strip() for block in (text or "").splitlines() if block.strip()]
    return "".join(f"<p>{_esc(block)}</p>" for block in blocks) or "<p>—</p>"


def meeting_document_title(reuniao) -> str:
    """File name for the meeting document in Drive."""
    return f"Reunião - {reuniao.titulo}"


def build_meeting_document_html(
    *,
    titulo: str,
    cliente_nome: str,
    data_reuniao,
    resumo: str,
    transcricao: str,
) -> str:
    """Build the HTML body for the meeting document."""
    header_rows = [
        ("Cliente", cliente_nome or "Sem cliente vinculado"),
        ("Data da reunião", _format_datetime(data_reuniao)),
    ]
    meta = "".join(
        f"<p><strong>{_esc(label)}:</strong> {_esc(value)}</p>"
        for label, value in header_rows
    )

    return (
        "<html><body>"
        f"<h1>{_esc(titulo)}</h1>"
        f"{meta}"
        "<h2>Resumo</h2>"
        f"{_render_markdownish(resumo)}"
        "<h2>Transcrição completa</h2>"
        f"{_render_paragraphs(transcricao)}"
        "</body></html>"
    )
