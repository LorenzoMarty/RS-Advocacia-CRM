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

Para a arquitetura de reunioes e IA, consulte a nota `Arquitetura` no vault do projeto (ver `CLAUDE.md`
> `## Contexto no Obsidian`).

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

Em producao o backend HTTP nao executa worker Celery persistente.
Use Redis externo e rode o worker no mesmo servidor GCP (ver secao abaixo).
Sem worker ativo, a gravacao fica presa no status "enviada".

Se nao houver Redis, configure `MEETINGS_PROCESSING_MODE=inline`. Nesse modo a
transcricao e o resumo rodam na propria requisicao de upload; funciona para
audios curtos.

### Upload de gravacoes em producao (Drive direto)

O audio nunca passa pelo backend: o navegador pede uma sessao de upload resumable
(`POST /api/reunioes/<id>/gravacoes/sessao-upload/`), envia o blob direto ao
Google Drive (PUT na URL da sessao, sem token no navegador) e confirma
(`POST /api/reunioes/<id>/gravacoes/confirmar/`). O arquivo fica em
`<GOOGLE_DRIVE_ROOT_FOLDER_ID>/<Cliente>/Reuniões/` (ou `<root>/Reuniões avulsas`)
e o worker baixa do Drive com o token de quem enviou (`Gravacao.enviada_por`).
O endpoint multipart antigo (`POST /api/reunioes/<id>/gravacoes/`) segue valido
para dev local/inline e blobs pequenos.

## Worker de gravacoes (GCP)

Web (Gunicorn), worker Celery, beat e Redis rodam juntos na VM GCP via Docker
Compose (`deploy/gcp-free/`), com Caddy na frente fazendo TLS. O broker Redis
fica só na rede interna do compose (sem TLS/porta exposta).

Primeira instalacao (na VM GCP, com Docker instalado):

```bash
git clone <repo> && cd Agenda-Juri/deploy/gcp-free
cp .env.example .env       # preencher DATABASE_URL, OPENAI_API_KEY, GOOGLE_*, SECRET_KEY, REDIS_PASSWORD
docker compose up -d
```

Isso sobe `web`, `worker`, `beat`, `redis` e `caddy` no mesmo compose;
`CELERY_BROKER_URL`/`REDIS_URL` já são fixados internamente pelo próprio
`docker-compose.yml` (`redis://:${REDIS_PASSWORD}@redis:6379/0`), não precisa
configurar na mão. Detalhes completos em `deploy/gcp-free/README.md`.

Atualizacao apos `git pull`: `docker compose up -d --build`.

Troubleshooting:

- Gravacao presa em "enviada": worker parado ou broker inacessivel
  (`docker compose ps`, `docker compose logs worker`).
- Gravacao "falhou" pedindo reconexao do Google: quem enviou desconectou a conta;
  reconectar em Integracoes e reenviar.
- Teste do worker: `docker compose exec worker celery -A jurisagenda inspect ping`.

## Tecnologias

- Python
- Django
- PostgreSQL
- React

## OAuth Google

- O login Google e a autorizacao Calendar/Drive usam um unico fluxo backend com `openid email profile`, `https://www.googleapis.com/auth/calendar.events` e `https://www.googleapis.com/auth/drive` (escopo completo do Drive; ver secao "Google Drive" abaixo sobre por que `drive.file` nao e suficiente).
- O backend armazena access/refresh tokens criptografados em `integrations.GoogleAccount`; o React nunca recebe tokens Google.
- `access_type=offline` e `prompt=consent` sao enviados no fluxo backend para obter e manter refresh token de forma previsivel.
- Os compromissos sao enviados para os calendarios habilitados na integracao, iniciando por `GOOGLE_CALENDAR_ID`.
- A sincronizacao usa `syncToken` por calendario para importar alteracoes incrementais; webhooks do Google Calendar acionam nova sincronizacao pelo backend.
- Eventos importados do Google usam um cliente tecnico `Google Agenda` e um processo tecnico `GOOGLE-CALENDAR` ate serem reclassificados na aplicacao.
- Use `GOOGLE_CALENDAR_ID=primary` para gravar na agenda principal da conta conectada ou informe o ID de uma agenda compartilhada do Google Calendar.
- O usuario que autoriza o Google precisa ter permissao de edicao nessa agenda.
- Configure `GOOGLE_TOKEN_ENCRYPTION_KEY` com uma chave Fernet estavel em producao antes de aplicar as migracoes.
- Callback exato do backend em producao:
  `https://api.203.0.113.10.sslip.io/api/auth/google/callback`
- Origin do frontend publicado atualmente:
  `https://rs-advocacia.pages.dev`
- O mesmo `GOOGLE_CLIENT_ID` deve ser usado no backend que inicia o OAuth e no projeto do Google Cloud onde os test users foram cadastrados.
- `GOOGLE_ALLOWED_HOSTED_DOMAIN` e opcional e aceita somente dominio do Google Workspace, como `empresa.com`. Para contas Gmail ou contas especificas, use `GOOGLE_ALLOWED_EMAILS`, separado por virgula.

### Google Drive (documentos por cliente)

- O scope `drive` (acesso completo, nao mais `drive.file`) foi adicionado ao fluxo OAuth para permitir ler/escrever a arvore `Clientes/...` que ja existia no Drive do escritorio antes da integracao — `drive.file` so enxerga arquivos criados pelo proprio app. **Usuarios ja conectados antes dessa mudanca precisam reconectar a conta Google** (`/api/autenticacao/google?force_consent=1`); sem o re-consent as chamadas ao Drive retornam 401.
- Defina `GOOGLE_DRIVE_ROOT_FOLDER_ID` com o ID da pasta `Clientes` no Drive (Shared Drive do escritorio ou pasta compartilhada). A pasta precisa estar compartilhada com a conta Google que grava. Sem essa variavel, os endpoints de documentos retornam 503.
- `DRIVE_MAX_FILE_SIZE_MB` (default 25) limita o tamanho de upload.
- Estrutura criada sob demanda: `Clientes/<Nome do Cliente>/{Peticoes,Documentos,Outros}`. Os metadados ficam espelhados no banco (`documentos.DocumentoCliente`); o Drive guarda o binario.
- Reenviar um arquivo com o mesmo nome/categoria do cliente substitui o conteudo via `files.update` (nova revisao, mesmo arquivo) em vez de duplicar.
- Endpoints: `GET/POST /api/clientes/<id>/documentos/...`, `GET /api/clientes/<id>/drive/estrutura/`. Detalhes no registro `2026-06-09-integracao-google-drive` do vault do projeto.
- **Importacao em massa de clientes existentes no Drive** (`documentos/importacao.py`): `GET /api/drive/importar/clientes/descobrir/` lista pastas de 1o nivel sob `GOOGLE_DRIVE_ROOT_FOLDER_ID` que ainda nao tem `Cliente` vinculado; `POST /api/drive/importar/clientes/confirmar/` (body `{"pastas": [{"pasta_id", "nome"}, ...]}`) cria um `Cliente` por pasta aprovada (so `nome` preenchido — CPF/telefone/email ficam para completar depois), vincula a pasta *existente* (nao cria uma nova) e roda a deteccao de processos por CNJ (`escanear_arvore`/`sugerir_plano`/`confirmar_importacao`) para cada cliente novo. O wizard de import por cliente existente (tela "Importar do Drive") foi removido em 2026-07-19 — essas funcoes de `importacao.py` agora sao consumidas so por este fluxo em massa e por "Organizar com IA" (`documentos/organizacao.py`).
- **Sincronizacao continua** (`documentos/tasks.py`, task Celery `documentos.sincronizar_drive`, agendada a cada 10 min em `jurisagenda/celery.py`): consome a Drive Changes API (`GoogleDriveSync` guarda o `startPageToken` por conta em `integrations/models.py`) e reage automaticamente — sem revisao humana, ao contrario da importacao em massa — a: pasta nova de 1o nivel em `GOOGLE_DRIVE_ROOT_FOLDER_ID` vira `Cliente` novo; mudanca dentro de uma pasta que o CRM ja conhece (cliente ou processo) reescaneia so aquela pasta; pasta movida para lixeira marca `Cliente.ativo=False` ou `Processo.status="Inativo (pasta removida do Drive)"` (nunca deleta o registro nem o arquivo no Drive).
- Enriquecimento por IA dos campos que o nome da pasta nao da (`vara`, `area_juridica`) foi descartado por decisao do usuario — esses campos devem virar opcionais em auditoria propria dos forms, nao preenchidos por IA.

### Deploy do OAuth

- Aplique `python manage.py migrate` no banco de producao antes de publicar o backend; as migracoes movem tokens legados para `integrations.GoogleAccount` e removem os campos antigos.
- Defina `DATABASE_URL` para um PostgreSQL ativo. O estado OAuth e a sessao Django dependem do banco ja na primeira redirecao ao Google.
- Em producao mantenha `CORS_ALLOW_ALL_ORIGINS=false` e configure `CORS_ALLOWED_ORIGINS` e `CSRF_TRUSTED_ORIGINS` com a URL HTTPS exata do React.
- Se React e Django usarem origens HTTPS distintas, mantenha `SESSION_COOKIE_SAMESITE=None`, `SESSION_COOKIE_SECURE=true`, `CSRF_COOKIE_SAMESITE=None` e `CSRF_COOKIE_SECURE=true`.
- Para maior previsibilidade de sessao em navegadores que bloqueiam cookies entre sites, publique frontend e API sob o mesmo site ou use um proxy `/api` no dominio do frontend.
- Configure `GOOGLE_CALENDAR_WEBHOOK_URL=https://api.203.0.113.10.sslip.io/api/integracoes/google/calendar/webhook` para ativar push notifications do Google Calendar.

## Autor

**Lorenzo Marty**\
Github: https://github.com/LorenzoMarty
