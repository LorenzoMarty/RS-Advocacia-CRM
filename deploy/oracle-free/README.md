# Deploy gratuito na Oracle Cloud Always Free

Esta opcao roda tudo que o Agenda-Juri precisa em uma VM gratuita:

- Django HTTP com Gunicorn
- React/Vite como site estatico
- PostgreSQL persistente
- Redis persistente
- Celery worker persistente para reunioes
- Caddy com HTTPS automatico

E a melhor opcao gratuita para este projeto porque o sistema precisa de banco,
Redis e worker sempre ligado. Planos gratuitos de PaaS costumam dormir, expirar
banco gratuito ou nao oferecer worker gratuito.

Links principais:

- Oracle Free Tier: https://www.oracle.com/cloud/free/
- Recursos Always Free e limites: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- FAQ do Free Tier: https://www.oracle.com/cloud/free/faq/
- Criar conta Oracle Cloud: https://signup.oraclecloud.com/
- Documentacao de Compute/VMs: https://docs.oracle.com/en-us/iaas/Content/Compute/home.htm
- Instalar Docker: https://docs.docker.com/engine/install/ubuntu/
- Docker Compose: https://docs.docker.com/compose/
- Caddy com HTTPS automatico: https://caddyserver.com/docs/automatic-https
- sslip.io para dominio gratuito apontando para IP: https://sslip.io/
- Google OAuth web server: https://developers.google.com/identity/protocols/oauth2/web-server
- Google Cloud Console: https://console.cloud.google.com/

## Antes de comecar

Crie uma VM Ubuntu Always Free na Oracle Cloud. Use a shape ARM/Ampere quando
disponivel, porque ela tem folga para rodar Postgres, Redis, Django e Celery.

Guias uteis da Oracle:

- Criar uma instancia Compute: https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm
- Conectar via SSH: https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/accessinginstance.htm
- Security lists: https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securitylists.htm
- Network security groups: https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/networksecuritygroups.htm

Abra as portas 80 e 443 no security list/firewall da VM.

Use um host publico apontando para o IP da VM. Sem comprar dominio, uma opcao e
usar DNS wildcard publico como:

```text
agenda-juri.<IP_PUBLICO>.sslip.io
```

Exemplo: se o IP for `203.0.113.10`, use
`agenda-juri.203.0.113.10.sslip.io`.

## Limites gratuitos da Oracle

Confira os numeros atuais na documentacao oficial antes de criar a VM:
https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm

No momento deste guia:

- Ampere A1 Always Free equivale a 2 OCPUs e 12 GB RAM rodando o mes inteiro.
- O limite e 1.500 OCPU-horas/mes e 9.000 GB-horas/mes.
- O armazenamento Always Free total de Block Volume e 200 GB.
- O trafego de saida Always Free e 10 TB/mes.
- Instancias Always Free muito ociosas podem ser paradas/reclamadas pela Oracle.
- Pode haver erro de falta de capacidade ao criar a shape gratuita; tente outra
  availability domain ou aguarde.

## Instalar Docker na VM

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker
docker compose version
```

Referencia: https://docs.docker.com/engine/install/ubuntu/

## Subir o sistema

```bash
git clone <URL_DO_REPO>
cd Agenda-Juri/deploy/oracle-free
cp .env.example .env
nano .env
docker compose up -d --build
```

Preencha no `.env`:

- `DOMAIN`, `ALLOWED_HOSTS`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS` e `CSRF_TRUSTED_ORIGINS`
- `SECRET_KEY`
- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`
- `GOOGLE_DRIVE_ROOT_FOLDER_ID`, se usar Drive
- `OPENAI_API_KEY`, se usar transcricao/resumo

Gere a chave Fernet para `GOOGLE_TOKEN_ENCRYPTION_KEY`:

```bash
docker compose run --rm web python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Crie o admin:

```bash
docker compose exec web python manage.py createsuperuser
```

Verifique saude:

```bash
curl -i https://<SEU_DOMAIN>/health/
curl -i https://<SEU_DOMAIN>/ready/
docker compose ps
docker compose logs -f web worker
```

O Caddy gera HTTPS automaticamente quando `DOMAIN` aponta corretamente para o IP
publico e as portas 80/443 estao abertas.

## Google Cloud

No OAuth Client do Google, configure:

- Authorized JavaScript origins: `https://<SEU_DOMAIN>`
- Authorized redirect URI: `https://<SEU_DOMAIN>/api/auth/google/callback`

Configure tambem:

```env
GOOGLE_REDIRECT_URI=https://<SEU_DOMAIN>/api/auth/google/callback
GOOGLE_CALENDAR_WEBHOOK_URL=https://<SEU_DOMAIN>/api/integracoes/google/calendar/webhook
```

Links uteis:

- Google Cloud Console: https://console.cloud.google.com/
- Credenciais OAuth: https://console.cloud.google.com/apis/credentials
- OAuth 2.0 para web server: https://developers.google.com/identity/protocols/oauth2/web-server
- Google Calendar API: https://developers.google.com/calendar/api
- Google Drive API: https://developers.google.com/drive/api

## Atualizar depois de um git pull

```bash
cd Agenda-Juri/deploy/oracle-free
git pull
docker compose up -d --build
```

## Backups basicos

O banco fica no volume Docker `postgres-data`. Faca dump periodico:

```bash
docker compose exec db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup.sql
```

Para backup mais seguro, envie o arquivo para outro lugar, como Google Drive.

## Checklist rapido

- [ ] Conta Oracle criada.
- [ ] VM Ubuntu Ampere A1 criada como Always Free.
- [ ] Portas 80 e 443 abertas na Oracle.
- [ ] Docker e Docker Compose instalados.
- [ ] `DOMAIN` aponta para o IP publico da VM.
- [ ] `.env` preenchido em `deploy/oracle-free`.
- [ ] `docker compose up -d --build` executado.
- [ ] `https://<SEU_DOMAIN>/health/` retorna 200.
- [ ] `https://<SEU_DOMAIN>/ready/` retorna 200.
- [ ] OAuth do Google configurado com callback novo.
- [ ] Backup do Postgres testado.

## Limites e riscos

- O hosting pode ficar sem mensalidade, mas a OpenAI cobra por uso se as funcoes
  de IA forem usadas.
- Recursos Always Free podem sofrer falta de capacidade na criacao da VM.
- A Oracle pode considerar instancias muito ociosas como inativas. Mantenha
  backups fora da VM.
- Este deploy usa banco e Redis dentro da VM; se a VM for apagada sem backup, os
  dados somem.
