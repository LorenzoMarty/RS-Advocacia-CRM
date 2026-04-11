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
- HTML, CSS, JS

## Autor

**Lorenzo Marty**\
Github: https://github.com/LorenzoMarty
