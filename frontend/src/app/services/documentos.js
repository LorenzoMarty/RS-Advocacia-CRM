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
