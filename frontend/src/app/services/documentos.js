import { apiRequest } from '../api';

// --- Folder explorer (Drive-live) -------------------------------------------

function folderFromApi(folder) {
  return {
    id: String(folder.id || ''),
    name: folder.nome || '',
    // True only for user-created auto-numbered folders (renameable).
    managed: Boolean(folder.gerenciada),
  };
}

function driveFileFromApi(file) {
  return {
    id: String(file.id || ''),
    name: file.nome || '',
    mimeType: file.mime_type || '',
    link: file.link || '',
    size: Number(file.tamanho_bytes || 0),
    updatedAt: file.modificado_em || '',
  };
}

export async function listClientDrive(clientId, folderId) {
  const query = folderId ? `?folder_id=${encodeURIComponent(folderId)}` : '';
  const payload = await apiRequest(`/api/clientes/${clientId}/drive/listar/${query}`);
  return {
    folderId: String(payload.folder_id || ''),
    rootId: String(payload.raiz_id || ''),
    folders: (payload.pastas || []).map(folderFromApi),
    files: (payload.arquivos || []).map(driveFileFromApi),
  };
}

export async function createDriveFolder(clientId, { name, parentId }) {
  const payload = await apiRequest(`/api/clientes/${clientId}/drive/pastas/`, {
    method: 'POST',
    body: JSON.stringify({ nome: name, parent_id: parentId }),
  });
  return folderFromApi(payload.pasta);
}

export async function renameDriveFolder(clientId, { folderId, name }) {
  const payload = await apiRequest(
    `/api/clientes/${clientId}/drive/pastas/${encodeURIComponent(folderId)}/`,
    {
      method: 'PATCH',
      body: JSON.stringify({ nome: name }),
    },
  );
  return folderFromApi(payload.pasta);
}

export async function deleteDriveFolder(clientId, folderId) {
  await apiRequest(`/api/clientes/${clientId}/drive/pastas/${encodeURIComponent(folderId)}/`, {
    method: 'DELETE',
  });
  return folderId;
}

export async function uploadToDriveFolder(clientId, { file, folderId }) {
  const data = new FormData();
  data.append('arquivo', file, file.name);
  data.append('folder_id', folderId);
  const payload = await apiRequest(`/api/clientes/${clientId}/drive/upload/`, {
    method: 'POST',
    body: data,
  });
  return driveFileFromApi(payload.arquivo);
}

// --- AI folder organization (suggest plan -> human review -> apply) --------

function processSuggestionFromApi(item) {
  return {
    numeroProcesso: item.numero_processo || '',
    originFolderId: item.origem_pasta_id || '',
    originFolderName: item.origem_pasta_nome || '',
    legalArea: item.area_juridica || '',
    description: item.descricao || '',
    origin: item.origem || 'heuristica',
    needsHabilitacao: Boolean(item.precisa_habilitar),
  };
}

function organizeOperationFromApi(item) {
  return {
    type: item.tipo || '',
    ref: item.ref || '',
    name: item.nome || '',
    parentId: item.pai_id || '',
    fileId: item.arquivo_id || '',
    targetId: item.destino_id || '',
    targetRef: item.destino_ref || '',
    newName: item.novo_nome || '',
    reason: item.motivo || '',
  };
}

function organizeOperationToApi(item) {
  return {
    tipo: item.type,
    ref: item.ref || '',
    nome: item.name || '',
    pai_id: item.parentId || '',
    arquivo_id: item.fileId || '',
    destino_id: item.targetId || '',
    destino_ref: item.targetRef || '',
    novo_nome: item.newName || '',
    motivo: item.reason || '',
  };
}

function processWarningFromOrganizeApi(item) {
  return {
    title: item.titulo || '',
    reason: item.motivo || '',
    partialNumber: item.numero_parcial || '',
    originFolderId: item.origem_pasta_id || '',
    originFolderName: item.origem_pasta_nome || '',
  };
}

export async function suggestDriveOrganization(clientId) {
  const payload = await apiRequest(
    `/api/clientes/${clientId}/drive/organizar/sugerir/`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
    { timeoutMs: 90_000 },
  );
  return {
    operations: (payload.operacoes || []).map(organizeOperationFromApi),
    discarded: Number(payload.descartadas || 0),
    processesSuggested: (payload.processos_sugeridos || []).map(processSuggestionFromApi),
    processWarnings: (payload.avisos_processos || []).map(processWarningFromOrganizeApi),
  };
}

export async function applyDriveOrganization(clientId, operations, processes = []) {
  const payload = await apiRequest(`/api/clientes/${clientId}/drive/organizar/aplicar/`, {
    method: 'POST',
    body: JSON.stringify({
      operacoes: operations.map(organizeOperationToApi),
      processos: processes.map((item) => ({
        numero_processo: item.numeroProcesso,
        origem_pasta_id: item.originFolderId,
        area_juridica: item.legalArea || '',
        descricao: item.description || '',
        precisa_habilitar: Boolean(item.needsHabilitacao),
      })),
    }),
  });
  return {
    applied: Number(payload.aplicadas || 0),
    failures: payload.falhas || [],
    rejected: payload.rejeitadas || [],
    processesCreated: Number(payload.processos_criados || 0),
  };
}

// --- Bulk client discovery (scan "Clientes" root -> suggest -> confirm) ----

function newClientCandidateFromApi(item) {
  return {
    folderId: item.pasta_id || '',
    name: item.nome || '',
  };
}

export async function discoverNewClients() {
  const payload = await apiRequest('/api/drive/importar/clientes/descobrir/');
  return (payload.candidatos || []).map(newClientCandidateFromApi);
}

export async function confirmNewClients(candidates) {
  const payload = await apiRequest('/api/drive/importar/clientes/confirmar/', {
    method: 'POST',
    body: JSON.stringify({
      pastas: candidates.map((item) => ({ pasta_id: item.folderId, nome: item.name })),
    }),
  });
  return {
    clientsCreated: (payload.clientes_criados || []).length,
  };
}
