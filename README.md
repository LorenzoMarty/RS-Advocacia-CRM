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
Use Redis externo e rode o worker em um servico separado, como Render, Railway,
Fly.io ou uma VM. Sem worker ativo, a gravacao fica sem transcricao/resumo.

Se nao houver Redis, configure `MEETINGS_PROCESSING_MODE=inline`. Nesse modo a
transcricao e o resumo rodam na propria requisicao de upload; funciona para
audios curtos, mas pode estourar o limite de tempo da Vercel em gravacoes longas.

## Tecnologias

- Python
- Django
- PostgreSQL
- React

## OAuth Google

- O login Google e a autorizacao Calendar usam um unico fluxo backend com `openid email profile` e `https://www.googleapis.com/auth/calendar.events`.
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
