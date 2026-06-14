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
