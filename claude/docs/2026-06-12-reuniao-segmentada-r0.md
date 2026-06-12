# Reunião segmentada em 5 min — transcrição rolling + resumo incremental (2026-06-12)

## Contexto
Meta do cliente: **R$0 de mensalidade** → deploy só Vercel + Postgres free, sem VM/worker
Celery (`MEETINGS_PROCESSING_MODE=inline`). Problema: inline processa transcrição+resumo
**dentro do request**, limitado ao timeout da função Vercel (Hobby ≤ 60s). Reunião longa estoura.

Solução escolhida (Hipótese A): **gravar em trechos de 5 min no browser**, cada trecho é um
request independente que cabe no timeout. Reunião vira N trechos → duração ilimitada, sem VM.
Para a costura e o contexto:
- **Transcrição com prompt rolling:** cada trecho é transcrito sozinho, semeado com a cauda
  (~600 chars) da transcrição do trecho anterior, para continuidade na emenda.
- **Resumo incremental (refine):** em vez de resumir a transcrição inteira (estoura contexto),
  mantém-se um **relatório corrente na `Reuniao`** atualizado a cada trecho com
  `(relatório_atual + novo_trecho)`. Contexto por chamada é constante; duração ilimitada.
  A transcrição completa fica preservada (concatenação dos trechos).

## Modelo de dados
- `Gravacao.ordem` (PositiveIntegerField): índice do trecho na reunião. Cada chunk de 5 min é
  uma `Gravacao`; reusa toda a máquina de upload/confirm/processamento existente.
- `Reuniao.resumo` (TextField): relatório corrente, refinado por trecho.
- Migration `meetings/0005_gravacao_ordem_reuniao_resumo`.

## Backend
- `ai/prompts/meetings.py`: + `SUMMARY_REFINE_INSTRUCTIONS` (atualiza relatório existente com novo trecho).
- `ai/providers/base.py`: `transcribe(..., contexto_anterior="")` + `refine_summary(resumo_atual, novo_trecho)`.
- `ai/providers/openai_provider.py`: transcribe injeta a cauda no `prompt` (limite
  `MAX_CONTEXTO_ANTERIOR_CHARS=600`); `refine_summary` via `responses.create`.
- `ai/services/meetings.py`: `transcribe_audio(contexto_anterior=...)` + `refine_summary(...)`.
- `meetings/tasks.py` (`processar_gravacao`): pega cauda do trecho anterior (`_contexto_anterior`),
  transcreve com ela, e `_atualizar_resumo_reuniao` refina `Reuniao.resumo` sob
  `select_for_update` (serializa trechos processados em paralelo no modo inline). O resumo agora
  é **nível-reunião**; `Gravacao.resumo` deixa de ser usado.
- `meetings/services.py` + `views.py`: `confirmar_upload`/`enviar_gravacao` aceitam `ordem`.
  `serialize_reuniao` expõe `resumo` + `transcricao` (concatenação ordenada); `serialize_gravacao`
  expõe `ordem`.

## Frontend
- `hooks/use-meeting-recorder.js`: reescrito para **segmentar**. Streams (aba+mic) e AudioContext
  ficam vivos a reunião toda; só o `MediaRecorder` é recriado por trecho (cada chunk é um webm
  decodável sozinho). A cada `SEGMENT_DURATION_MS` (5 min) emite `onSegment({blob, filename, ordem})`
  e recomeça. Removido o auto-stop de 20 min; `SAFETY_MAX_RECORDING_MS=4h` evita gravação esquecida.
- `components/audio-recorder.jsx`: trechos sobem por uma **fila sequencial** (um de cada vez →
  mantém ordem no Drive e evita refine concorrente). Mostra tempo decorrido + nº de trechos.
- `services/meetings.js`: `confirmRecording`/multipart passam `ordem`; `meetingFromApi` lê
  `summary`/`transcript` da reunião; + `getMeeting(id)`.
- `pages/meetings.jsx`: painel **Resumo da reunião** (nível-reunião) + **Transcrição completa**;
  lista de **Trechos** (cada `Gravacao` com status/transcrição). Polling refaz a **reunião** inteira
  (`getMeeting`) enquanto houver trecho processando.

## Deploy R$0
- `backend/vercel.json`: + `functions["api/index.py"].maxDuration = 60` (necessário p/ inline; default
  da Vercel é baixo demais). Hobby teto = 60s; trecho de 5 min cabe.
- Setar `MEETINGS_PROCESSING_MODE=inline`; **não** setar `CELERY_BROKER_URL`/`REDIS_URL`. Sem VM.
- Custo restante: OpenAI por uso (não mensalidade). Vercel Hobby é uso não-comercial pelos ToS —
  escritório é comercial; tecnicamente pediria Pro (US$20/mo). Risco de ToS, não custo técnico.

## Limitações
- Corte "seco" a cada 5 min pode partir uma frase; o prompt rolling suaviza a emenda, mas não há overlap de áudio.
- Resumo incremental pode perder nuance fina vs. resumir tudo de uma vez (aceitável p/ ata).
- Edição manual de transcrição por trecho não re-dispara o refine do resumo da reunião.

## Verificação
- Backend: `DATABASE_URL="sqlite://:memory:" DEBUG=true .venv/Scripts/python.exe manage.py test meetings ai documentos` (55 ok).
  Inclui `SegmentacaoTaskTests` (cauda + refine incremental acumulado).
- Frontend: `npm test` (41 ok), `npx eslint`, `npm run build` — limpos.
- Manual: gravar reunião Meet > 5 min → ver trechos subindo, resumo da reunião crescendo,
  transcrição completa concatenando.
