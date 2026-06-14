import { apiRequest } from '../api';

export function recordingFromApi(recording) {
  if (!recording) {
    return null;
  }

  return {
    id: String(recording.id || recording.pk),
    ordem: Number(recording.ordem || 0),
    driveFileId: recording.drive_file_id || '',
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
    // Meeting-level running summary + concatenated transcript (segments are
    // refined into one report; see backend meetings.tasks).
    summary: meeting.resumo || '',
    transcript: meeting.transcricao || '',
    documentLink: meeting.documento_link || '',
    documentGeneratedAt: meeting.documento_gerado_em || '',
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

export async function finalizeMeeting(meetingId) {
  const payload = await apiRequest(`/api/reunioes/${meetingId}/finalizar/`, {
    method: 'POST',
  });
  return meetingFromApi(payload.reuniao);
}

// Vercel functions reject bodies over ~4.5 MB, so the multipart endpoint only
// works for small blobs; real recordings go straight from the browser to Drive.
export const MULTIPART_FALLBACK_MAX_BYTES = 4 * 1024 * 1024;

export function chooseUploadStrategy({ sessionErrorStatus, blobSize }) {
  if (sessionErrorStatus == null) {
    return 'drive';
  }
  if (sessionErrorStatus === 503 && blobSize <= MULTIPART_FALLBACK_MAX_BYTES) {
    return 'multipart';
  }
  return 'fail';
}

export async function createRecordingUploadSession(meetingId, { filename, contentType, size }) {
  return apiRequest(`/api/reunioes/${meetingId}/gravacoes/sessao-upload/`, {
    method: 'POST',
    body: JSON.stringify({
      nome_arquivo: filename,
      mime_type: contentType,
      tamanho_bytes: size,
    }),
  });
}

export function uploadBlobToDrive(uploadUrl, blob, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText || '{}'));
        } catch {
          resolve({});
        }
      } else {
        reject(new Error(`Falha ao enviar o audio ao Google Drive (${xhr.status}).`));
      }
    };
    xhr.onerror = () => {
      reject(new Error('Falha de rede ao enviar o audio ao Google Drive.'));
    };

    xhr.send(blob);
  });
}

export async function confirmRecording(meetingId, { driveFileId, filename, contentType, ordem = 0 }) {
  const payload = await apiRequest(`/api/reunioes/${meetingId}/gravacoes/confirmar/`, {
    method: 'POST',
    body: JSON.stringify({
      drive_file_id: driveFileId,
      nome_original: filename,
      mime_type: contentType,
      ordem,
    }),
  });
  return recordingFromApi(payload.gravacao);
}

async function uploadRecordingViaDrive(meetingId, recording, { onProgress } = {}) {
  const contentType = recording.blob?.type || 'audio/webm';
  const session = await createRecordingUploadSession(meetingId, {
    filename: recording.filename,
    contentType,
    size: recording.blob?.size || 0,
  });

  const driveFile = await uploadBlobToDrive(session.upload_url, recording.blob, { onProgress });
  if (!driveFile.id) {
    throw new Error('O Google Drive nao confirmou o upload do audio. Tente novamente.');
  }

  return confirmRecording(meetingId, {
    driveFileId: driveFile.id,
    filename: recording.filename,
    contentType,
    ordem: recording.ordem || 0,
  });
}

async function uploadRecordingMultipart(meetingId, recording) {
  const data = new FormData();
  data.append('audio', recording.blob, recording.filename);
  data.append('ordem', String(recording.ordem || 0));

  const payload = await apiRequest(`/api/reunioes/${meetingId}/gravacoes/`, {
    method: 'POST',
    body: data,
  });
  return recordingFromApi(payload.gravacao);
}

export async function uploadRecording(meetingId, recording, { onProgress } = {}) {
  try {
    return await uploadRecordingViaDrive(meetingId, recording, { onProgress });
  } catch (error) {
    const strategy = chooseUploadStrategy({
      sessionErrorStatus: error?.status ?? null,
      blobSize: recording.blob?.size || 0,
    });

    if (strategy === 'multipart') {
      // Drive/queue not configured (e.g. local dev) and the blob is small
      // enough for the legacy multipart endpoint.
      return uploadRecordingMultipart(meetingId, recording);
    }

    if (error?.status === 401) {
      throw new Error(
        'Conecte sua conta Google em Integracoes para enviar gravacoes ao Drive.',
      );
    }
    throw error;
  }
}

export async function getRecording(recordingId) {
  const payload = await apiRequest(`/api/reunioes/gravacoes/${recordingId}/`);
  return recordingFromApi(payload.gravacao);
}

export async function getMeeting(meetingId) {
  const payload = await apiRequest(`/api/reunioes/${meetingId}/`);
  return meetingFromApi(payload.reuniao);
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
