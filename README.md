# Agenda-Juri

Sistema desenvolvido para facilitar a rotina de um escritorio de advocacia, com gerenciamento de clientes, processos e compromissos.

## Funcionalidades

- Gestao de clientes
- Gestao de processos
- Gestao de compromissos
- Agenda de compromissos
- Sistema de autenticacao
- Dashboard enxuto e personalizavel

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
python manage.py runserver
```

## Tecnologias

- Python
- Django
- PostgreSQL
- React

## OAuth Google

- O login com Google usa apenas `openid email profile`.
- A permissao sensivel do Google Calendar fica em um fluxo separado, iniciado pela tela de Agenda.
- Os compromissos sao enviados para a agenda definida em `GOOGLE_CALENDAR_ID`.
- Use `GOOGLE_CALENDAR_ID=primary` para gravar na agenda principal da conta conectada ou informe o ID de uma agenda compartilhada do Google Calendar.
- O usuario que autoriza o Google precisa ter permissao de edicao nessa agenda.
- Callback exato do backend em producao:
  `https://agenda-juri-backend.vercel.app/api/auth/google/callback/`
- Origin do frontend publicado atualmente:
  `https://agenda-juri-orcin.vercel.app`
- O mesmo `GOOGLE_CLIENT_ID` deve ser usado no backend que inicia o OAuth e no projeto do Google Cloud onde os test users foram cadastrados.

## Autor

**Lorenzo Marty**\
Github: https://github.com/LorenzoMarty
