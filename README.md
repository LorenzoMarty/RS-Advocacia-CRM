# Agenda Juri

Aplicação jurídica com frontend React/Vite em `frontend/` e backend Django em `backend/`.

O fluxo atual usa o Django como API, Supabase Postgres como banco do backend e Vercel para publicar backend e frontend em projetos separados.

## Estrutura

- `frontend/`: aplicação React/Vite. Consome a API via `VITE_API_URL`.
- `backend/`: projeto Django com endpoints JSON, admin e configuração para `DATABASE_URL`.

## Banco Supabase

Crie um projeto no Supabase e copie a connection string do Postgres em Project Dashboard > Connect.

Para deploy serverless na Vercel, prefira a string do pooler em Transaction mode e mantenha `sslmode=require` na URL. O backend também desativa prepared statements na conexão, porque o Transaction pooler do Supabase não aceita prepared statements.

Exemplo de formato:

```text
postgresql://postgres.project-ref:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require
```

Nunca coloque `DATABASE_URL` no frontend.

## Rodar localmente

Backend:

```powershell
cd backend
uv sync
$env:DATABASE_URL="sua-url-do-supabase"
$env:SECRET_KEY="uma-chave-local"
$env:DEBUG="true"
$env:ALLOWED_HOSTS="127.0.0.1,localhost"
$env:CORS_ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
uv run python manage.py migrate
uv run python manage.py seed_demo
uv run python manage.py runserver
```

Frontend:

```powershell
cd frontend
npm install
$env:VITE_API_URL="http://127.0.0.1:8000"
npm run dev
```

Login demo após `seed_demo`:

```text
Email: usuario@example.com
Senha: 123456
```

Sem `VITE_API_URL`, o frontend ainda abre com dados locais em memória. Com `VITE_API_URL`, ele chama os endpoints Django.

## Endpoints Django

Os endpoints abaixo são uma camada CRUD simples para integrar a interface. Antes de usar com dados sensíveis em produção, adicione autenticação/autorização server-side; CORS e login client-side não substituem controle de acesso no backend.

- `GET /api/bootstrap/`
- `POST /api/auth/login/`
- `GET|POST /api/clients/`
- `GET|PUT|PATCH|DELETE /api/clients/<id>/`
- `GET|POST /api/processes/`
- `GET|PUT|PATCH|DELETE /api/processes/<id>/`
- `GET|POST /api/events/`
- `GET|PUT|PATCH|DELETE /api/events/<id>/`
- `GET|POST /api/users/`
- `GET|PUT|PATCH|DELETE /api/users/<id>/`
- `GET|POST /api/roles/`
- `GET|PUT|PATCH|DELETE /api/roles/<id>/`

## Deploy do backend na Vercel

Crie primeiro o projeto do backend.

| Campo | Valor |
| --- | --- |
| Root Directory | `backend` |
| Framework Preset | `Other` |
| Build Command | definido em `backend/vercel.json` |

Configure estas variáveis no projeto do backend na Vercel:

```text
SECRET_KEY=uma-chave-segura
DEBUG=false
DATABASE_URL=sua-url-do-supabase
DATABASE_CONN_MAX_AGE=0
ALLOWED_HOSTS=seu-backend.vercel.app
CORS_ALLOWED_ORIGINS=https://seu-frontend.vercel.app
```

Deploy pela CLI:

```powershell
npx vercel@latest --cwd backend
npx vercel@latest --cwd backend --prod
```

Depois do deploy do backend, aplique as migrações no Supabase usando a mesma `DATABASE_URL`:

```powershell
cd backend
$env:DATABASE_URL="sua-url-do-supabase"
$env:SECRET_KEY="uma-chave-segura"
$env:DEBUG="false"
$env:ALLOWED_HOSTS="seu-backend.vercel.app"
uv run python manage.py migrate
uv run python manage.py seed_demo
uv run python manage.py createsuperuser
```

Teste:

```text
https://seu-backend.vercel.app/api/bootstrap/
```

## Deploy do frontend na Vercel

Crie um segundo projeto para a interface.

| Campo | Valor |
| --- | --- |
| Root Directory | `frontend` |
| Framework Preset | `Vite` |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Configure no projeto do frontend:

```text
VITE_API_URL=https://seu-backend.vercel.app
```

Deploy pela CLI:

```powershell
npx vercel@latest --cwd frontend
npx vercel@latest --cwd frontend --prod
```

O app usa `HashRouter`, então rotas internas ficam com `#/`, por exemplo:

```text
https://seu-frontend.vercel.app/#/clientes
```

## Checklist

- Supabase criado e `DATABASE_URL` copiada do Transaction pooler.
- Backend publicado com `Root Directory` em `backend`.
- Backend com `SECRET_KEY`, `DATABASE_URL`, `ALLOWED_HOSTS` e `CORS_ALLOWED_ORIGINS`.
- `uv run python manage.py migrate` aplicado no Supabase.
- `uv run python manage.py seed_demo` aplicado ou usuário admin criado.
- Frontend publicado com `Root Directory` em `frontend`.
- Frontend com `VITE_API_URL` apontando para a URL do backend.
- `/api/bootstrap/` responde na URL pública do backend.
- Login, dashboard, clientes, processos, agenda, usuários e cargos testados no frontend publicado.
