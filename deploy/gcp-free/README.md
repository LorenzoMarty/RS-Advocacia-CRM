# Deploy gratuito: GCP e2-micro + Neon + Cloudflare Pages

Roda o Agenda-Juri de graca usando tres servicos always-free:

| Parte | Servico | Gratis porque |
|---|---|---|
| Frontend (SPA) | Cloudflare Pages | Banda ilimitada, build na nuvem |
| Postgres | Neon free | 0,5 GB armazenamento, sem expiracao |
| API + worker + Redis | GCP e2-micro VM | Always Free em us-central1/us-west1/us-east1 |

A VM roda Django (Gunicorn), Celery worker, Redis e Caddy via Docker Compose.
Postgres e frontend ficam fora da VM para caber em 1 GB de RAM.

Unico custo operacional: chamadas OpenAI para transcricao/resumo de reunioes.

Links principais:

- GCP Always Free: https://cloud.google.com/free/docs/free-cloud-features
- Neon free: https://neon.tech/pricing
- Cloudflare Pages: https://pages.cloudflare.com
- sslip.io (dominio gratis via IP): https://sslip.io

---

## Passo 1 — Neon (Postgres gerenciado)

1. Crie uma conta em https://neon.tech e um novo projeto (regiao US East / US West).
2. No painel, va em **Connection Details**, selecione **Pooled connection** e copie
   a string de conexao. Ela termina com `?sslmode=require`.
3. Guarde — e o valor de `DATABASE_URL` no `.env`.

---

## Passo 2 — Cloudflare Pages (frontend)

1. Crie uma conta em https://pages.cloudflare.com.
2. **Novo projeto > Conectar ao Git** → selecione o repo `LorenzoMarty/Agenda-Juri`.
3. Configure a build:
   - **Diretorio raiz:** `frontend`
   - **Comando de build:** `npm run build`
   - **Diretorio de saida:** `dist`
   - **Variavel de ambiente:** `VITE_API_URL` = `https://api.SEU_IP_PUBLICO.sslip.io/api`
     (preencha o IP so apos criar a VM no Passo 3; pode fazer re-deploy depois)
4. Clique em **Salvar e implantar**. Anote a URL `*.pages.dev` gerada.

---

## Passo 3 — VM GCP e2-micro (Always Free)

### 3.1 Criar a VM

1. Acesse https://console.cloud.google.com/compute/instances.
2. Crie uma nova instancia:
   - **Tipo de maquina:** `e2-micro`
   - **Regiao:** `us-central1`, `us-west1` ou `us-east1` (fora dessas regioes nao e gratis)
   - **SO:** Ubuntu 22.04 LTS ou 24.04 LTS
   - **Disco de inicializacao:** 30 GB HDD (Standard) — gratis ate 30 GB
   - **Firewall:** marque *Permitir trafico HTTP* e *Permitir trafico HTTPS*
3. Clique em **Criar** e aguarde. Anote o **IP externo** da VM.

Referencia: https://cloud.google.com/compute/docs/create-linux-vm-instance

### 3.2 Abrir firewall (se nao marcou na criacao)

No painel GCP em **VPC > Regras de firewall**, confirme que as portas 80 e 443
estao liberadas para `0.0.0.0/0`.

### 3.3 Conectar via SSH e preparar a VM

```bash
# Adicionar swap (evita OOM no 1 GB de RAM)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Instalar Docker
sudo apt update && sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker
docker compose version
```

---

## Passo 4 — Dominio gratis via sslip.io

Sem comprar dominio, use:

```
api.<IP_PUBLICO>.sslip.io
```

Exemplo: IP `34.56.78.90` → dominio `api.34.56.78.90.sslip.io`.

O Caddy usa esse dominio para gerar HTTPS automaticamente via Let's Encrypt.

---

## Passo 5 — Subir o sistema

### 5.1 Clonar o repo na VM

```bash
git clone https://github.com/LorenzoMarty/Agenda-Juri.git
cd Agenda-Juri/deploy/gcp-free
```

### 5.2 Configurar o .env

```bash
cp .env.example .env
nano .env
```

Preencha obrigatoriamente:

- `DOMAIN` — ex: `api.34.56.78.90.sslip.io`
- `ALLOWED_HOSTS` — mesmo valor
- `SECRET_KEY` — string aleatoria de 50+ chars
- `DATABASE_URL` — connection string do Neon (Passo 1)
- `REDIS_PASSWORD` — senha forte
- `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` — URL do Cloudflare Pages
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (ver Passo 6)
- `GOOGLE_TOKEN_ENCRYPTION_KEY` — gere abaixo:

```bash
docker compose run --rm web python -c \
  "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Campos opcionais mas recomendados:

- `GOOGLE_DRIVE_ROOT_FOLDER_ID` — para armazenar documentos
- `OPENAI_API_KEY` — para transcricao/resumo de reunioes


### 5.3 Subir os containers

```bash
docker compose up -d --build
```

O primeiro build leva alguns minutos. Acompanhe com:

```bash
docker compose logs -f web worker
```

### 5.4 Criar o admin

```bash
docker compose exec web python manage.py createsuperuser
```

### 5.5 Verificar saude

```bash
curl -i https://api.SEU_IP.sslip.io/health/
curl -i https://api.SEU_IP.sslip.io/ready/
docker compose ps
docker stats --no-stream
```

`/health/` deve retornar 200. `/ready/` verifica DB + cache. `docker stats` deve mostrar
uso de RAM total abaixo de ~700 MB.

---

## Passo 6 — Google OAuth

No **Google Cloud Console** (https://console.cloud.google.com/apis/credentials):

1. Em **Credenciais OAuth > Seu cliente web**, adicione:
   - **Origens JavaScript autorizadas:** `https://SEU_APP.pages.dev`
   - **URIs de redirecionamento autorizados:** `https://api.SEU_IP.sslip.io/api/auth/google/callback`
2. Atualize no `.env`:
   ```
   GOOGLE_REDIRECT_URI=https://api.SEU_IP.sslip.io/api/auth/google/callback
   GOOGLE_CALENDAR_WEBHOOK_URL=https://api.SEU_IP.sslip.io/api/integracoes/google/calendar/webhook
   ```
3. Reinicie: `docker compose up -d`

---

## Passo 7 — URL da API no Cloudflare Pages

Apos ter o IP da VM, atualize a variavel de ambiente do Cloudflare Pages:

- `VITE_API_URL` = `https://api.SEU_IP_PUBLICO.sslip.io/api`

Dispare um re-deploy no painel do Cloudflare Pages.

---

## Atualizacao apos git pull

```bash
cd Agenda-Juri
git pull
cd deploy/gcp-free
docker compose up -d --build
```

---

## Backup do Postgres

O Postgres esta no Neon — o proprio Neon faz backup automatico no plano free.
Para exportar manualmente:

```bash
# Substitua pela connection string do Neon sem pooling (endpoint direto)
pg_dump "postgresql://user:senha@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require" \
  > backup-$(date +%F).sql
```

---

## Limites e riscos

- **RAM:** VM tem 1 GB + 2 GB swap. Gunicorn 2 workers + Celery 1 concurrency + Redis.
  Se adicionarmos muitas features pesadas, pode apertar. Monitore com `docker stats`.
- **Egress GCP free:** 1 GB/mes saindo para fora dos EUA. Chamadas ao Neon e OpenAI
  contam. Para um escritorio pequeno com uso moderado, fica dentro do limite.
- **sslip.io:** servico gratuito de terceiros. Se ficar fora, o HTTPS para. Fallback:
  comprar um dominio barato (~R$ 40/ano) e apontar o A record para o IP.
- **Reclame de instancia inativa:** GCP pode reclamar VMs e2-micro very idle em raros
  casos. Mantenha backups e o `.env` guardado.
- **OpenAI:** hosting gratis, mas transcricao/resumo cobram por uso de tokens.

---

## Checklist rapido

- [ ] Conta Neon criada; string de conexao copiada.
- [ ] Cloudflare Pages configurado; URL `*.pages.dev` anotada.
- [ ] VM GCP e2-micro criada (regiao us-central1/us-west1/us-east1); IP externo anotado.
- [ ] Firewall portas 80 e 443 abertas.
- [ ] Swap de 2 GB criado na VM.
- [ ] Docker instalado.
- [ ] `.env` preenchido com DATABASE_URL Neon, REDIS_PASSWORD, SECRET_KEY, GOOGLE_TOKEN_ENCRYPTION_KEY.
- [ ] `FRONTEND_URL`/`CORS_ALLOWED_ORIGINS`/`CSRF_TRUSTED_ORIGINS` = URL da Pages.
- [ ] `docker compose up -d --build` executado sem erros.
- [ ] `/health/` e `/ready/` retornam 200.
- [ ] Superuser criado.
- [ ] OAuth Google configurado (origins + redirect URI).
- [ ] Cloudflare Pages re-deployado com `VITE_API_URL` correto.
- [ ] Login via Google funciona na SPA.
