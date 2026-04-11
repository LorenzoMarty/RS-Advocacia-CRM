# Juri React

Aplicação jurídica convertida de templates Django para um frontend React com Vite. O frontend fica em `frontend/`; o backend Django fica em `backend/`, mas no estado atual o React usa dados em memória e não depende de API do Django para funcionar online.

## Estrutura

- `frontend/`: aplicação React/Vite que deve ser publicada como site estático.
- `backend/`: projeto Django mantido separado, hoje com raiz JSON e admin. Use apenas se você for criar APIs ou manter o admin online.

## Rodar localmente

Entre no frontend:

```powershell
cd frontend
npm install
npm run dev
```

Antes de publicar, valide o build:

```powershell
cd frontend
npm run lint
npm run build
npm run preview
```

O comando `npm run build` gera os arquivos finais em `frontend/dist`.

## Publicar o frontend na Vercel

Este é o caminho mais simples para deixar a interface online.

1. Envie o projeto para um repositório no GitHub, GitLab ou Bitbucket.
2. Acesse a Vercel e crie um novo projeto importando esse repositório.
3. Configure o projeto com estes valores:
   - Root Directory: `frontend`
   - Framework Preset: `Vite`
   - Install Command: `npm install`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Clique em Deploy.
5. Depois do deploy, use a URL gerada pela Vercel para acessar o sistema.
6. Para domínio próprio, vá em Project Settings > Domains e adicione seu domínio.

Como o React está usando `HashRouter`, as rotas aparecem com `#/` na URL, por exemplo `https://seu-site.vercel.app/#/clientes`. Isso evita erro 404 ao atualizar a página em uma rota interna.

## Publicar pela Vercel CLI

Se preferir publicar pelo terminal:

```powershell
cd frontend
npm install
npm run build
npx vercel
```

Para publicar em produção:

```powershell
cd frontend
npx vercel --prod
```

Quando a CLI perguntar, confirme que o diretório do projeto é `frontend`, o build command é `npm run build`, e o output directory é `dist`.

## Publicar em Netlify

Também funciona como site estático.

1. Crie um novo site a partir do repositório.
2. Configure:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Execute o deploy.

Se você não configurar `frontend` como base directory, use `frontend/dist` como publish directory.

## Sobre o backend Django

O backend foi separado do frontend. No estado atual:

- O frontend não chama endpoints Django.
- Os dados do frontend ficam em memória no `frontend/src/app/store.jsx`.
- Ao recarregar a página, mudanças feitas na interface podem voltar para os dados iniciais.

Se quiser deixar o backend online também, trate como um projeto separado e configure:

- Banco de dados persistente, como PostgreSQL. Não use SQLite para dados de produção em hospedagens serverless.
- `SECRET_KEY` seguro via variável de ambiente.
- `DEBUG=false`.
- `ALLOWED_HOSTS` com o domínio do backend.
- Migrações com `python manage.py migrate`.
- Usuário admin com `python manage.py createsuperuser`.

O arquivo `backend/vercel.json` ainda existe para um deploy separado do Django, mas isso só deve ser usado se você realmente for expor o backend. Para um app com dados reais, prefira primeiro criar APIs Django e trocar o store em memória do React por chamadas HTTP.

## Checklist antes de deixar online

- `npm run lint` passa sem erros.
- `npm run build` passa sem erros.
- O projeto da hospedagem aponta para `frontend`.
- O output directory está como `dist`.
- O site abre pela URL pública gerada.
- Login, dashboard, clientes, processos, agenda, usuários e cargos foram testados no link publicado.

## Próximo passo recomendado

Se o objetivo for usar dados reais, crie endpoints no Django para clientes, processos, agenda, usuários e cargos, depois configure o React para chamar a URL da API por uma variável como `VITE_API_URL`.
