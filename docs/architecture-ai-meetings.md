# Arquitetura de IA e reunioes

## Decisoes

- `meetings` e o dominio de reunioes: vinculos, arquivo de audio, status, transcricao e resumo persistidos.
- `ai` concentra chamadas de modelos, prompts e escolha do provider. Nenhuma chamada OpenAI fica em `meetings`.
- Celery executa transcricao e resumo fora da request HTTP; Redis atua como broker/backend.
- O backend preserva o contrato JSON ja existente no projeto, sem introduzir uma camada REST paralela.
- O frontend adiciona somente uma pagina, um componente de audio, dois hooks e um service.

## Fluxo

```text
React MediaRecorder ou arquivo local
  -> POST /api/reunioes/{id}/gravacoes/
  -> meetings.Gravacao (status=enviada)
  -> Celery/Redis: meetings.tasks.processar_gravacao
  -> ai.services.meetings.transcribe_recording
  -> ai.providers.openai_provider (gpt-4o-transcribe)
  -> ai.services.meetings.summarize_transcript
  -> ai.providers.openai_provider (gpt-4.1-mini, Responses API, store=False)
  -> meetings.Gravacao (status=concluida, transcricao, resumo)
  -> React consulta status ate exibir o resultado
```

## Arvore implementada

```text
Agenda-Juri/
|-- README.md
|-- docs/
|   `-- architecture-ai-meetings.md
|-- backend/
|   |-- .env.example
|   |-- manage.py
|   |-- pyproject.toml
|   |-- requirements.txt
|   |-- uv.lock
|   |-- agenda/                       # compromissos/calendario, existente
|   |-- clientes/                     # clientes, existente
|   |-- core/                         # envelope JSON e permissoes, existente
|   |-- processos/                    # processos, existente
|   |-- usuarios/                     # autenticacao/cargos, ampliado com permissoes
|   |-- ai/
|   |   |-- __init__.py
|   |   |-- apps.py
|   |   |-- tests.py
|   |   |-- prompts/
|   |   |   |-- __init__.py
|   |   |   `-- meetings.py
|   |   |-- providers/
|   |   |   |-- __init__.py
|   |   |   |-- base.py
|   |   |   `-- openai_provider.py
|   |   `-- services/
|   |       |-- __init__.py
|   |       `-- meetings.py
|   |-- meetings/
|   |   |-- __init__.py
|   |   |-- admin.py
|   |   |-- apps.py
|   |   |-- forms.py
|   |   |-- models.py
|   |   |-- tasks.py
|   |   |-- tests.py
|   |   |-- urls.py
|   |   |-- views.py
|   |   `-- migrations/
|   |       |-- __init__.py
|   |       `-- 0001_initial.py
|   `-- jurisagenda/
|       |-- __init__.py               # carrega Celery
|       |-- celery.py
|       |-- settings.py
|       `-- urls.py
`-- frontend/
    `-- src/
        |-- App.jsx
        |-- app/
        |   |-- api.js                # fetch/CSRF e multipart
        |   |-- data.js               # navegacao
        |   |-- layout.jsx            # icone da nova area
        |   |-- pages/
        |   |   `-- meetings.jsx
        |   |-- components/
        |   |   `-- audio-recorder.jsx
        |   |-- hooks/
        |   |   |-- use-audio-recorder.js
        |   |   `-- use-recording-polling.js
        |   `-- services/
        |       `-- meetings.js
        `-- styles/
            |-- main.css
            `-- pages/
                `-- meetings.css
```

## Responsabilidades

| Pasta/arquivo | Responsabilidade |
| --- | --- |
| `backend/meetings/models.py` | Armazena reuniao, audio, ciclo de processamento e resultados. |
| `backend/meetings/views.py` | Recebe contexto/upload, valida tamanho/formato e responde status. |
| `backend/meetings/tasks.py` | Atualiza estados e aciona servicos de IA fora da request. |
| `backend/ai/providers/openai_provider.py` | Unico ponto que conhece o SDK OpenAI e IDs de modelos. |
| `backend/ai/prompts/meetings.py` | Prompts versionaveis do caso de uso. |
| `backend/ai/services/meetings.py` | Operacoes de IA consumidas pelo dominio sem conhecer HTTP/Celery. |
| `frontend/src/app/services/meetings.js` | Contrato HTTP e mapeamento da API para a tela. |
| `frontend/src/app/hooks/use-audio-recorder.js` | Acesso ao microfone e criacao de arquivo webm/mp4. |
| `frontend/src/app/hooks/use-recording-polling.js` | Atualiza processamento pendente sem WebSocket prematuro. |

## Endpoints

| Metodo | Rota | Uso |
| --- | --- | --- |
| `GET` | `/api/reunioes/` | Lista reunioes e gravacoes. |
| `POST` | `/api/reunioes/criar/` | Cria reuniao ligada a cliente/processo. |
| `GET` | `/api/reunioes/{id}/` | Detalhe da reuniao. |
| `POST` | `/api/reunioes/{id}/gravacoes/` | Persiste audio e enfileira tarefa, retornando `202`. |
| `GET` | `/api/reunioes/gravacoes/{id}/` | Consulta transcricao/resumo/status. |

## Modelos OpenAI

- Transcricao: `gpt-4o-transcribe`, configuravel por `OPENAI_TRANSCRIPTION_MODEL`.
- Resumo: `gpt-4.1-mini`, configuravel por `OPENAI_SUMMARY_MODEL`.
- Diarizacao futura: trocar o modelo para `gpt-4o-transcribe-diarize` exigira armazenar segmentos e enviar `response_format=diarized_json` com `chunking_strategy=auto`.

A Audio API aceita `mp3`, `mp4`, `mpeg`, `mpga`, `m4a`, `wav` e `webm` e documenta limite atual de 25 MB. Por isso o upload valida os mesmos formatos e o limite configuravel padrao e `25`.

Documentacao oficial consultada:

- [Speech to text](https://developers.openai.com/api/docs/guides/speech-to-text)
- [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini)
- [Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses)

## Operacao local

Variaveis essenciais no backend:

```dotenv
DATABASE_URL=postgresql://usuario:senha@localhost:5432/agenda_juri
OPENAI_API_KEY=sua-chave-openai
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-transcribe
OPENAI_SUMMARY_MODEL=gpt-4.1-mini
REDIS_URL=redis://localhost:6379/0
```

Processos locais, a partir de `backend/`:

```powershell
uv sync
python manage.py migrate
python manage.py runserver
celery -A jurisagenda worker -l INFO --pool=solo
```

O Redis deve estar iniciado antes do worker. Em Linux/macOS, o worker pode usar o pool padrao do Celery.

## Crescimento sem excesso

- Uma nova funcionalidade de IA cria prompt e service em `ai`; o app de dominio continua dono dos dados.
- Um provider alternativo implementa as duas operacoes de `ai/providers/base.py` e e escolhido em `get_provider()`.
- Segmentos com locutor, revisao humana ou reprocessamento podem ser adicionados a `meetings` quando houver demanda real.
- Arquivos de audio juridicos devem usar armazenamento privado em producao; o `FileField` local serve desenvolvimento, nao e uma politica de acesso a documentos.
- O worker Celery precisa de processo persistente; ele nao deve depender apenas de funcoes serverless do deploy HTTP.

