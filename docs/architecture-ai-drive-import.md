# AI-assisted Drive import & folder organization

Extends the per-client Drive import wizard (`documentos/importacao.py`) with two
AI-powered flows. Both follow the project's AI boundary: **`documentos` owns the
data and orchestration; `ai` owns the model calls** (`ai/providers/openai_provider.py`
is the only file that knows the OpenAI SDK).

## Flow A — AI scan (detect processos / classify documents)

`POST api/clientes/<id>/drive/importar/escanear/` with `{"usar_ia": true}`.

1. `importacao.escanear_arvore` walks the client folder (names only, bounded by
   `MAX_NOS`/`MAX_PROFUNDIDADE`).
2. `importacao.sugerir_plano_ia` runs the existing CNJ/keyword heuristics, then
   sends the tree (names + mime types only — **never file contents**) to
   `ai.services.drive_import.classificar_arvore`, one model call per scan
   (`OPENAI_CLASSIFICATION_MODEL`, default `gpt-4.1-mini`, `store=False`,
   `text.format json_object`).
3. Merge rules (AI output is untrusted):
   - A CNJ number from the AI is only accepted if it passes
     `core.br_identifiers.extrair_cnj` (mod 97-10). **Never trust an AI CNJ.**
   - Heuristic findings win on conflict; AI only fills empty
     `area_juridica`/`descricao` and re-categorizes documents the heuristics
     left as `other`.
   - Drive ids not present in the scanned tree are discarded.
   - Processos the AI spots **without** a visible CNJ become
     `avisos_processos_sem_numero`; the reviewer types the number in the wizard
     or drops the item. They are never auto-created.
   - Any AI failure degrades to the plain heuristic plan with
     `ia: {usada: false, aviso: ...}` — the wizard keeps working without IA.

Plan payload is a superset of the non-AI plan, so `confirmar_importacao` and the
old wizard path are unchanged.

## Flow B — AI folder organization

`POST api/clientes/<id>/drive/organizar/sugerir/` → review in UI →
`POST api/clientes/<id>/drive/organizar/aplicar/` (`documentos/organizacao.py`).

- The AI proposes operations towards the firm convention (Petições/Documentos/
  Outros + one folder per processo). Allowed types: `move`, `rename`,
  `create_folder` — whitelist enforced server-side.
- Containment proof: every referenced id must exist in a fresh scan rooted at
  the client's folder, so no operation can touch Drive content outside it. The
  client root itself cannot be moved/renamed; folder moves that would create a
  cycle are rejected.
- New folders are referenced by a temporary `ref` resolved at apply time
  (`create_folder` executes first, then `move`, then `rename`).
- Batch capped at `DRIVE_AI_MAX_OPERACOES` (default 100). Apply is not
  transactional: per-item failures are reported and re-running is safe.
- `aplicar` requires `documentos.change_documentocliente`; nothing is written
  without explicit human approval in the review step.
- Moves/renames update the mirrored `DocumentoCliente.drive_folder_id`/`nome`.

## Frontend

- `components/client-import-wizard.jsx`: "Analisar com IA" toggle, degraded-AI
  notice, and the "processos sem número" review section (CNJ input, 20-digit
  shape check client-side; the backend re-validates).
- `components/client-drive-organize.jsx`: suggest → review (checkbox per
  operation) → apply. Entry point: "Organizar com IA" button in
  `client-documents.jsx`.
- API mappers in `services/documentos.js`.

## Future phase (hooks left in place)

Reading file contents (PDF/Google Docs export) for better extraction would need
a `files().export` helper in `integrations/google/drive.py`, a Celery task with
status fields (copy the `meetings.Gravacao.status` pattern), and an extra
`trechos` field in `ai.services.drive_import.serializar_arvore_para_ia`.
