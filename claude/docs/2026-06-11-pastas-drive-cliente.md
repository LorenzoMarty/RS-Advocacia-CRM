# Explorador de pastas no Drive do cliente (2026-06-11)

## Contexto
Antes: documentos do cliente tinham 3 categorias fixas (Petições/Documentos/Outros)
espelhadas no banco (`DocumentoCliente`, único por `cliente+categoria+nome`). O usuário
pediu um **explorador de pastas** de verdade: pastas aninhadas arbitrárias, criar/excluir
pasta, soltar (drag-drop) arquivos, abrir arquivos pelas ferramentas Google (Docs/preview).

## Decisões
- **Drive ao vivo (sem espelho de árvore no banco).** As pastas/arquivos são listados direto
  do Google Drive a cada navegação. O `DocumentoCliente` **não** é usado pelo explorador novo
  (continua existindo para o fluxo legado, que segue intacto — coexistência).
- **Template garantido na abertura, não no create.** Não mexemos em `clientes/views.py` nem
  `processos/views.py`. Ao abrir a aba Documentos (listagem da raiz), `ensure_client_template`
  cria de forma idempotente a pasta-raiz do cliente + pastas fixas + uma pasta por processo.
  Vantagens: mecanismo único, sem acoplar CRUD ao Drive, não quebra criação de cliente/processo
  se o Google estiver desconectado, e cobre clientes antigos e novos igualmente.
- **Nome da pasta de processo:** `"<area_juridica> - <numero_processo>"` (Processo não tem campo
  "tipo de ação"; usamos `area_juridica`). Subpastas: `PETIÇÕES/PROTOCOLADOS/RECURSOS`.
- **Pastas fixas do template:** `1. DOCUMENTOS PESSOAIS`, `2. CONTRATOS E PROCURAÇÕES`, `5. OUTROS`.
- **Abrir arquivo:** `webViewLink` do Drive em nova aba (Drive já oferece "Abrir com Google Docs").

## Backend
- `integrations/google/drive.py`: + `list_folders(service, parent_id)`, + `delete_folder(...)`.
- `documentos/services.py`: + `ensure_client_template`, `_ensure_cliente_root` (cacheia
  `pasta_cliente_id` reusando `ClienteDrive`, inclusive linhas legadas), `_nome_pasta_processo`,
  `listar_conteudo_pasta`, `criar_pasta`, `excluir_pasta`, `upload_para_pasta`,
  `_client_root_id`. Constantes `TEMPLATE_FOLDERS`, `PROCESSO_SUBPASTAS`.
  Import de `processos.models.Processo` é lazy dentro de `ensure_client_template`.
- `documentos/views.py` + `urls.py`: novos endpoints sob `api/clientes/<id>/drive/`:
  - `GET listar/?folder_id=<id>` (raiz quando omitido → garante template)
  - `POST pastas/` `{nome, parent_id}`
  - `DELETE pastas/<folder_id>/` (bloqueia excluir a raiz do cliente)
  - `POST upload/` (multipart `arquivo` + `folder_id`; mesma validação de extensão/tamanho do
    upload legado). **Não** cria `DocumentoCliente`.
- Permissões reusam as do app `documentos` (view/add/delete_documentocliente).

## Frontend
- `services/documentos.js`: + `listClientDrive`, `createDriveFolder`, `deleteDriveFolder`,
  `uploadToDriveFolder` (mappers `folderFromApi`/`driveFileFromApi`). Funções legadas mantidas.
- `components/client-documents.jsx`: reescrito como explorador — breadcrumb, entrar em pasta,
  criar pasta, excluir pasta (confirm), drag-drop + botão de upload, abrir arquivo no Drive.
- CSS em `styles/pages/clientes-detail.css` (breadcrumb, dropzone, folder-item).

## Limitações / pendências
- **Tamanho de upload em produção:** o `upload/` é multipart e na Vercel o body é limitado a
  ~4,5 MB (igual ao upload legado de documentos). Para arquivos grandes, falta portar o fluxo
  resumable browser→Drive já usado em `meetings` (sessão + confirmar). Anotado para depois.
- **Escopo de `folder_id`:** a navegação confia nos ids retornados pelo Drive; não há validação
  de ancestralidade. Aceitável porque cada usuário usa as próprias credenciais Google (ACL do
  Drive já limita o acesso). A raiz do cliente é sempre derivada no servidor.

## Verificação
- Backend: `DATABASE_URL="sqlite://:memory:" DEBUG=true .venv/Scripts/python.exe manage.py test documentos` (12 ok).
- Frontend: `npm test` (41 ok), `npx eslint`, backend `ruff check` — limpos.
- Manual: abrir aba Documentos de um cliente → ver pastas fixas + pasta do processo com
  subpastas; criar/excluir pasta; arrastar arquivo; abrir no Drive.
