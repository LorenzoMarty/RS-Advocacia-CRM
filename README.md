# Agenda-Juri

Sistema desenvolvido para facilitar a rotina de um escritório de advocacia, com gerenciamento de clientes, processos e compromissos.

## Funcionalidades

- Gestão de clientes
- Gestão de processos
- Gestão de compromissos
- Agenda de compromissos
- Sistema de autenticação
- Dashboard enxuto e personalizável

## Diferencial

O sistema foi pensado para:

- Aplicação prática do Direito
- Interface intuitiva e moderna
- Integração com demais ferramentas como: Google agenda

## Arquitetura

Fluxos principal:

1. O usuário loga na sua conta
2. Um cliente é criado
3. Um processo para um cliente é criado
4. Um evento do processo é salvo na agenda
5. As informações ficam disponíveis centralizadas no dashboard ou em páginas separadas por categoria.

## Instalação

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
- PostgreeSQL
- React

## OAuth Google

- O login com Google usa apenas `openid email profile`.
- A permissÃ£o sensÃ­vel do Google Calendar fica em um fluxo separado, iniciado pela tela de Agenda.
- Callback exato do backend em produÃ§Ã£o:
  `https://agenda-juri-backend.vercel.app/api/auth/google/callback/`
- Origin do frontend publicado atualmente:
  `https://agenda-juri-orcin.vercel.app`
- O mesmo `GOOGLE_CLIENT_ID` deve ser usado no backend que inicia o OAuth e no projeto do Google Cloud onde os test users foram cadastrados.

## Autor

**Lorenzo Marty**\
Github: https://github.com/LorenzoMarty
