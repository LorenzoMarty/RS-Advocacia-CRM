import { apiRequest } from '../api';

function recordingFromApi(recording) {
  if (!recording) {
    return null;
  }

  return {
    id: String(recording.id || recording.pk),
    filename: recording.nome_original || '',
    contentType: recording.mime_type || '',
    size: Number(recording.tamanho_bytes || 0),
    status: recording.status || '',
    statusLabel: recording.status_label || '',
    transcript: recording.transcricao || '',
    summary: recording.resumo || '',
    provider: recording.provedor || '',
    transcriptionModel: recording.modelo_transcricao || '',
    summaryModel: recording.modelo_resumo || '',
    processingError: recording.erro_processamento || '',
    createdAt: recording.criada_em || '',
    completedAt: recording.processada_em || '',
  };
}

function meetingFromApi(meeting) {
  if (!meeting) {
    return null;
  }

  return {
    id: String(meeting.id || meeting.pk),
    title: meeting.titulo || '',
    meetingAt: meeting.data_reuniao || '',
    clientId: String(meeting.cliente_id || ''),
    clientName: meeting.cliente_nome || '',
    createdBy: meeting.criado_por || '',
    createdAt: meeting.criado_em || '',
    recordings: (meeting.gravacoes || []).map(recordingFromApi).filter(Boolean),
  };
}

export async function listMeetings() {
  const payload = await apiRequest('/api/reunioes/');
  return (payload.reunioes || []).map(meetingFromApi).filter(Boolean);
}

export async function createMeeting(meeting) {
  const payload = await apiRequest('/api/reunioes/criar/', {
    method: 'POST',
    body: JSON.stringify({
      titulo: meeting.title,
      data_reuniao: meeting.meetingAt || null,
      cliente: meeting.clientId || null,
    }),
  });
  return meetingFromApi(payload.reuniao);
}

export async function updateMeeting(meetingId, meeting) {
  const payload = await apiRequest(`/api/reunioes/${meetingId}/editar/`, {
    method: 'PUT',
    body: JSON.stringify({
      titulo: meeting.title,
      data_reuniao: meeting.meetingAt || null,
      cliente: meeting.clientId || null,
    }),
  });
  return meetingFromApi(payload.reuniao);
}

export async function deleteMeeting(meetingId) {
  await apiRequest(`/api/reunioes/${meetingId}/excluir/`, {
    method: 'DELETE',
  });
  return String(meetingId);
}

export async function uploadRecording(meetingId, recording) {
  const data = new FormData();
  data.append('audio', recording.blob, recording.filename);

  const payload = await apiRequest(`/api/reunioes/${meetingId}/gravacoes/`, {
    method: 'POST',
    body: data,
  });
  return recordingFromApi(payload.gravacao);
}

export async function getRecording(recordingId) {
  const payload = await apiRequest(`/api/reunioes/gravacoes/${recordingId}/`);
  return recordingFromApi(payload.gravacao);
}

export async function updateRecording(recordingId, recording) {
  const payload = await apiRequest(`/api/reunioes/gravacoes/${recordingId}/editar/`, {
    method: 'PATCH',
    body: JSON.stringify({
      transcricao: recording.transcript,
    }),
  });
  return recordingFromApi(payload.gravacao);
}

export async function deleteRecording(recordingId) {
  await apiRequest(`/api/reunioes/gravacoes/${recordingId}/excluir/`, {
    method: 'DELETE',
  });
  return String(recordingId);
}
