# UI de reunião estilo documento (2026-06-16)

## Contexto

A página de reuniões (`frontend/src/app/pages/meetings.jsx` + `components/audio-recorder.jsx`)
funciona, mas a tela é densa: três botões de captura (microfone, reunião/Meet, enviar arquivo),
resumo e transcrição empilhados sem hierarquia de "documento". Pedido: tela mais bonita, estilo
Google Docs, **um** botão de gravar + **um** de enviar arquivo, e visualização fácil do que está
acontecendo (gravando / processando).

## Decisões

- **Captura = 2 botões.** "Gravar reunião" (aba + microfone, `useMeetingRecorder`, modo Meet) e
  "Enviar arquivo". Remove "Gravar microfone" (mic-only via `useAudioRecorder.startRecording`).
  O upload de arquivo continua usando `useAudioRecorder.selectFile` + preview/descartar.
- **Documento = Resumo da IA** como conteúdo principal, renderizado como folha-documento.
  Transcrição completa e Trechos viram seções recolhíveis abaixo.
- **Sem nova dependência.** Usa o design system próprio (CSS em `styles/pages/meetings.css`,
  animações `framer-motion`, toasts `sonner`) — todos já no projeto. Não instala shadcn (regra 5).

## Escopo (só apresentação)

Não muda: services/store/API, parser de resumo (`MeetingSummary`), polling de gravação, lógica de
upload de segmentos, modelos/back-end.

### Layout — 2 áreas

1. **Sidebar (lista)** — coluna estreita à esquerda. Card por reunião (título, data, cliente, badge
   de status), botão "Nova reunião", empty state. Selecionar abre o documento à direita.
2. **Documento (principal)** — folha branca centrada (`max-width ~780px`, sombra, padding generoso,
   escala tipográfica de documento). De cima pra baixo:
   - Barra de ação sticky: voltar, "Ver no Drive" (se houver), "Finalizar/Atualizar documento",
     "Editar reunião".
   - Cabeçalho do doc: título + cliente · data.
   - **Barra de captura**: `Gravar reunião` + `Enviar arquivo`. Preview do arquivo selecionado
     (audio + transcrever/descartar) aparece logo abaixo quando há arquivo.
   - **Painel de status vivo**: enquanto grava, indicador pulsante "Gravando MM:SS · N trechos" +
     progresso de upload; pipeline `Enviada → Transcrevendo → Resumindo → Concluída` em destaque.
   - **Resumo** renderizado como página de documento (reusa `MeetingSummary`).
   - **Transcrição completa** e **Trechos (N)** como seções recolhíveis (`<details>` ou toggle
     animado), sem competir com o resumo.

### Arquivos tocados

- `components/audio-recorder.jsx` — remove botão microfone; deixa 2 botões; painel de status vivo
  mais claro. Mantém props (`onUpload`) e fluxo de segmentos.
- `pages/meetings.jsx` — reorganiza a workspace em folha-documento; seções recolhíveis para
  transcrição/trechos. Sidebar de lista mantém comportamento atual.
- `styles/pages/meetings.css` — novas classes (`.meeting-doc`, status vivo, seções recolhíveis).

## Verificação

- `npm run lint` e `npm test` (vitest) passam.
- Visual: gravar reunião mostra status vivo + pipeline; enviar arquivo mostra preview; resumo
  renderiza como documento; transcrição/trechos recolhem.
