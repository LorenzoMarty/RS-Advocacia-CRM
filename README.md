# Agenda-Juri

Sistema desenvolvido para facilitar a rotina de um escritorio de advocacia, com gerenciamento de clientes, processos e compromissos.

## Funcionalidades

- Gestao de clientes
- Gestao de processos
- Gestao de compromissos
- Agenda de compromissos
- Sistema de autenticacao
- Dashboard enxuto e personalizavel
- Reunioes com gravacao, transcricao e resumo por IA

## Diferencial

O sistema foi pensado para:

- Aplicacao pratica do Direito
- Interface intuitiva e moderna
- Integracao com demais ferramentas, incluindo Google Agenda

## Arquitetura

Fluxo principal:

1. O usuario faz login na sua conta.
2. Um cliente e criado.
3. Um processo e criado para esse cliente.
4. Um evento do processo e salvo na agenda.
5. As informacoes ficam centralizadas no dashboard e nas paginas por categoria.

Para a arquitetura de reunioes e IA, consulte [`docs/architecture-ai-meetings.md`](docs/architecture-ai-meetings.md).

## Instalacao

```bash
git clone https://github.com/LorenzoMarty/Agenda-Juri.git
cd Agenda-Juri
python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux/macOS
source .venv/bin/activate

pip install -r requirements.txt
```

## Executando o projeto

```bash
cd backend
python manage.py runserver
```

## Processamento de IA

O audio de reunioes e processado fora da requisicao HTTP com Celery e Redis.
Configure `OPENAI_API_KEY` e `REDIS_URL` conforme `backend/.env.example`, aplique
as migracoes e inicie um worker separado:

```bash
cd backend
python manage.py migrate
celery -A jurisagenda worker -l INFO
```

No Windows, use `celery -A jurisagenda worker -l INFO --pool=solo`.

Em producao na Vercel, o backend HTTP nao executa worker Celery persistente.
Use Redis externo e rode o worker em um servico separado (ver secao abaixo).
Sem worker ativo, a gravacao fica presa no status "enviada".

Se nao houver Redis, configure `MEETINGS_PROCESSING_MODE=inline`. Nesse modo a
transcricao e o resumo rodam na propria requisicao de upload; funciona para
audios curtos, mas pode estourar o limite de tempo da Vercel em gravacoes longas.

### Upload de gravacoes em producao (Drive direto)

Funcoes da Vercel limitam o body a ~4,5 MB, entao o audio real nunca passa pelo
backend: o navegador pede uma sessao de upload resumable
(`POST /api/reunioes/<id>/gravacoes/sessao-upload/`), envia o blob direto ao
Google Drive (PUT na URL da sessao, sem token no navegador) e confirma
(`POST /api/reunioes/<id>/gravacoes/confirmar/`). O arquivo fica em
`<GOOGLE_DRIVE_ROOT_FOLDER_ID>/<Cliente>/Reuniões/` (ou `<root>/Reuniões avulsas`)
e o worker baixa do Drive com o token de quem enviou (`Gravacao.enviada_por`).
O endpoint multipart antigo (`POST /api/reunioes/<id>/gravacoes/`) segue valido
para dev local/inline e blobs de ate ~4 MB.

## Worker de gravacoes (VM)

O worker Celery + Redis rodam numa VM always-on via Docker Compose
(`deploy/worker/`). A Vercel enfileira no Redis da VM pela porta TLS 6380;
o worker consome pela rede interna do compose.

Primeira instalacao (na VM, com Docker instalado):

```bash
git clone <repo> && cd Agenda-Juri/deploy/worker
cp .env.example .env       # preencher DATABASE_URL, OPENAI_API_KEY, GOOGLE_*, SECRET_KEY, REDIS_PASSWORD
./redis/gen-certs.sh       # certificados TLS self-signed do Redis
docker compose up -d
```

Na Vercel, configure (e faca redeploy):

- `CELERY_BROKER_URL=rediss://:<REDIS_PASSWORD>@<host-da-vm>:6380/0?ssl_cert_reqs=CERT_NONE`
- `MEETINGS_PROCESSING_MODE=celery`
- **Nao** defina `REDIS_URL` na Vercel: ela tambem ativaria o cache Django via
  Redis remoto em todo request. So `CELERY_BROKER_URL`.

Liberar a porta 6380/TCP no firewall da VM (apenas ela). Atualizacao apos
`git pull`: `docker compose up -d --build worker`. Alternativa sem Docker:
`deploy/worker/systemd/agenda-juri-worker.service`.

Troubleshooting:

- Gravacao presa em "enviada": worker parado ou broker inacessivel
  (`docker compose ps`, `docker compose logs worker`).
- Gravacao "falhou" pedindo reconexao do Google: quem enviou desconectou a conta;
  reconectar em Integracoes e reenviar.
- Teste do broker de fora: `redis-cli --tls --insecure -h <host> -p 6380 -a <senha> ping`.
- Teste do worker: `docker compose exec worker celery -A jurisagenda inspect ping`.

## Tecnologias

- Python
- Django
- PostgreSQL
- React

## OAuth Google

- O login Google e a autorizacao Calendar/Drive usam um unico fluxo backend com `openid email profile`, `https://www.googleapis.com/auth/calendar.events` e `https://www.googleapis.com/auth/drive.file`.
- O backend armazena access/refresh tokens criptografados em `integrations.GoogleAccount`; o React nunca recebe tokens Google.
- `access_type=offline` e `prompt=consent` sao enviados no fluxo backend para obter e manter refresh token de forma previsivel.
- Os compromissos sao enviados para os calendarios habilitados na integracao, iniciando por `GOOGLE_CALENDAR_ID`.
- A sincronizacao usa `syncToken` por calendario para importar alteracoes incrementais; webhooks do Google Calendar acionam nova sincronizacao pelo backend.
- Eventos importados do Google usam um cliente tecnico `Google Agenda` e um processo tecnico `GOOGLE-CALENDAR` ate serem reclassificados na aplicacao.
- Use `GOOGLE_CALENDAR_ID=primary` para gravar na agenda principal da conta conectada ou informe o ID de uma agenda compartilhada do Google Calendar.
- O usuario que autoriza o Google precisa ter permissao de edicao nessa agenda.
- Configure `GOOGLE_TOKEN_ENCRYPTION_KEY` com uma chave Fernet estavel em producao antes de aplicar as migracoes.
- Callback exato do backend em producao:
  `https://agenda-juri-backend.vercel.app/api/auth/google/callback`
- Origin do frontend publicado atualmente:
  `https://agenda-juri-orcin.vercel.app`
- O mesmo `GOOGLE_CLIENT_ID` deve ser usado no backend que inicia o OAuth e no projeto do Google Cloud onde os test users foram cadastrados.
- `GOOGLE_ALLOWED_HOSTED_DOMAIN` e opcional e aceita somente dominio do Google Workspace, como `empresa.com`. Para contas Gmail ou contas especificas, use `GOOGLE_ALLOWED_EMAILS`, separado por virgula.

### Google Drive (documentos por cliente)

- O scope `drive.file` foi adicionado ao fluxo OAuth. **Usuarios ja conectados antes dessa mudanca precisam reconectar a conta Google** (`/api/autenticacao/google?force_consent=1`); sem o re-consent as chamadas ao Drive retornam 401.
- Defina `GOOGLE_DRIVE_ROOT_FOLDER_ID` com o ID da pasta `Clientes` no Drive (Shared Drive do escritorio ou pasta compartilhada). A pasta precisa estar compartilhada com a conta Google que grava. Sem essa variavel, os endpoints de documentos retornam 503.
- `DRIVE_MAX_FILE_SIZE_MB` (default 25) limita o tamanho de upload.
- Estrutura criada sob demanda: `Clientes/<Nome do Cliente>/{Peticoes,Documentos,Outros}`. Os metadados ficam espelhados no banco (`documentos.DocumentoCliente`); o Drive guarda o binario.
- Reenviar um arquivo com o mesmo nome/categoria do cliente substitui o conteudo via `files.update` (nova revisao, mesmo arquivo) em vez de duplicar.
- Endpoints: `GET/POST /api/clientes/<id>/documentos/...`, `GET /api/clientes/<id>/drive/estrutura/`. Detalhes em `claude/docs/2026-06-09-integracao-google-drive.md`.

### Deploy do OAuth

- Aplique `python manage.py migrate` no banco de producao antes de publicar o backend; as migracoes movem tokens legados para `integrations.GoogleAccount` e removem os campos antigos.
- Defina `DATABASE_URL` para um PostgreSQL ativo. O estado OAuth e a sessao Django dependem do banco ja na primeira redirecao ao Google.
- Em producao mantenha `CORS_ALLOW_ALL_ORIGINS=false` e configure `CORS_ALLOWED_ORIGINS` e `CSRF_TRUSTED_ORIGINS` com a URL HTTPS exata do React.
- Se React e Django usarem origens HTTPS distintas, mantenha `SESSION_COOKIE_SAMESITE=None`, `SESSION_COOKIE_SECURE=true`, `CSRF_COOKIE_SAMESITE=None` e `CSRF_COOKIE_SECURE=true`.
- Para maior previsibilidade de sessao em navegadores que bloqueiam cookies entre sites, publique frontend e API sob o mesmo site ou use um proxy `/api` no dominio do frontend.
- Configure `GOOGLE_CALENDAR_WEBHOOK_URL=https://agenda-juri-backend.vercel.app/api/integracoes/google/calendar/webhook` para ativar push notifications do Google Calendar.

## Autor

**Lorenzo Marty**\
Github: https://github.com/LorenzoMarty
