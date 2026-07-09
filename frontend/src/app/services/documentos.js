import { apiRequest } from '../api';

export const DOCUMENT_CATEGORIES = [
  { value: 'petition', label: 'Petições' },
  { value: 'document', label: 'Documentos' },
  { value: 'other', label: 'Outros' },
];

export function categoryLabel(category) {
  return DOCUMENT_CATEGORIES.find((item) => item.value === category)?.label || 'Outros';
}

function documentFromApi(doc) {
  return {
    id: String(doc.id || doc.pk),
    category: doc.categoria || 'other',
    name: doc.nome || '',
    mimeType: doc.mime_type || '',
    size: Number(doc.tamanho_bytes || 0),
    driveFileId: doc.drive_file_id || '',
    link: doc.link_visualizacao || '',
    createdAt: doc.criado_em || '',
    updatedAt: doc.atualizado_em || '',
  };
}

export async function listClientDocuments(clientId, category) {
  const query = category ? `?categoria=${encodeURIComponent(category)}` : '';
  const payload = await apiRequest(`/api/clientes/${clientId}/documentos/${query}`);
  return (payload.documentos || []).map(documentFromApi);
}

export async function uploadClientDocument(clientId, { file, category, name }) {
  const data = new FormData();
  data.append('arquivo', file, file.name);
  data.append('categoria', category);
  if (name) {
    data.append('nome', name);
  }
  const payload = await apiRequest(`/api/clientes/${clientId}/documentos/upload/`, {
    method: 'POST',
    body: data,
  });
  return documentFromApi(payload.documento);
}

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

// --- Drive import wizard (scan existing folder -> suggest -> confirm) ------

function processSuggestionFromApi(item) {
  return {
    numeroProcesso: item.numero_processo || '',
    originFolderId: item.origem_pasta_id || '',
    originFolderName: item.origem_pasta_nome || '',
  };
}

function documentSuggestionFromApi(item) {
  return {
    driveFileId: item.drive_file_id || '',
    name: item.nome || '',
    mimeType: item.mime_type || '',
    size: Number(item.tamanho_bytes || 0),
    folderId: item.drive_folder_id || '',
    link: item.link_visualizacao || '',
    category: item.categoria_sugerida || 'other',
    processNumber: item.numero_processo_sugerido || '',
    cpfCnpjFound: item.cpf_cnpj_encontrado || '',
  };
}

export async function scanClientDriveImport(clientId, folderId) {
  const payload = await apiRequest(`/api/clientes/${clientId}/drive/importar/escanear/`, {
    method: 'POST',
    body: JSON.stringify({ folder_id: folderId || '' }),
  });
  return {
    suggestedProcesses: (payload.processos_sugeridos || []).map(processSuggestionFromApi),
    suggestedDocuments: (payload.documentos_sugeridos || []).map(documentSuggestionFromApi),
  };
}

export async function confirmClientDriveImport(clientId, { processes, documents }) {
  const payload = await apiRequest(`/api/clientes/${clientId}/drive/importar/confirmar/`, {
    method: 'POST',
    body: JSON.stringify({
      processos: processes.map((item) => ({
        numero_processo: item.numeroProcesso,
        origem_pasta_id: item.originFolderId,
      })),
      documentos: documents.map((item) => ({
        drive_file_id: item.driveFileId,
        nome: item.name,
        mime_type: item.mimeType,
        tamanho_bytes: item.size,
        drive_folder_id: item.folderId,
        link_visualizacao: item.link,
        categoria: item.category,
        processo_numero: item.processNumber,
      })),
    }),
  });
  return {
    processesCreated: Number(payload.processos_criados || 0),
    documentsCreated: Number(payload.documentos_criados || 0),
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
