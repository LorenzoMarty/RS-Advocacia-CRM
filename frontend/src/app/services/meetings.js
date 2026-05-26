import { apiRequest } from '../api';

function demoDateTime(offset, time) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return `${localDate.toISOString().slice(0, 10)}T${time}:00`;
}

function createDemoMeetings() {
  return [
    {
      id: 'demo-meeting-concausas',
      title: 'Estudo interno sobre concausas',
      meetingAt: demoDateTime(0, '11:00'),
      clientId: '',
      clientName: '',
      createdBy: 'Renata Sampaio',
      createdAt: demoDateTime(0, '10:10'),
      recordings: [
        {
          id: 'demo-recording-concausas',
          filename: 'reuniao-concausas-demo.webm',
          contentType: 'audio/webm',
          size: 1843200,
          status: 'concluida',
          statusLabel: 'Concluida',
          transcript: 'Rose e Irua comentaram as anotacoes sobre concausas preexistente, concomitante e superveniente. A equipe alinhou a necessidade de revisar enunciados e sumulas para consolidar o material de estudo.',
          summary: [
            '## Resumo executivo',
            'Reuniao formativa para alinhar estudo juridico sobre concausas e nexo causal. O principal encaminhamento foi consolidar anotacoes e revisar referencias jurisprudenciais.',
            '',
            '## Participantes',
            '- Rose',
            '- Irua',
            '- Equipe juridica interna',
            '',
            '## Pontos discutidos',
            '- Classificacao das concausas em preexistente, concomitante e superveniente.',
            '- Dificuldade de acompanhar a exposicao sem material complementar.',
            '- Necessidade de consultar enunciados e sumulas relacionadas.',
            '',
            '## Proximas acoes',
            '- Solicitar anotacoes completas a Rose e Irua.',
            '- Preparar resumo juridico para a proxima aula.',
            '- Confirmar data do proximo encontro formativo.',
          ].join('\n'),
          provider: 'demo',
          transcriptionModel: 'Demo transcript',
          summaryModel: 'Demo summary',
          processingError: '',
          createdAt: demoDateTime(0, '10:15'),
          completedAt: demoDateTime(0, '10:18'),
        },
      ],
    },
    {
      id: 'demo-meeting-bruno',
      title: 'Alinhamento de audiencia - Bruno Lima',
      meetingAt: demoDateTime(1, '15:00'),
      clientId: 'demo-client-bruno',
      clientName: 'Bruno Lima',
      createdBy: 'Mariana Souza',
      createdAt: demoDateTime(0, '12:30'),
      recordings: [],
    },
  ];
}

let isUsingDemoMeetings = false;
let demoMeetings = createDemoMeetings();

function cloneRecording(recording) {
  return { ...recording };
}

function cloneMeeting(meeting) {
  return {
    ...meeting,
    recordings: meeting.recordings.map(cloneRecording),
  };
}

function nextDemoId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function demoClientName(clientId) {
  const names = {
    'demo-client-bruno': 'Bruno Lima',
    'demo-client-almeida': 'Almeida Comercio LTDA',
    'demo-client-ana': 'Ana Ribeiro',
  };
  return names[clientId] || '';
}

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
  try {
    const payload = await apiRequest('/api/reunioes/');
    isUsingDemoMeetings = false;
    return (payload.reunioes || []).map(meetingFromApi).filter(Boolean);
  } catch {
    isUsingDemoMeetings = true;
    return demoMeetings.map(cloneMeeting);
  }
}

export async function createMeeting(meeting) {
  if (isUsingDemoMeetings) {
    const nextMeeting = {
      id: nextDemoId('demo-meeting'),
      title: meeting.title,
      meetingAt: meeting.meetingAt || '',
      clientId: meeting.clientId || '',
      clientName: demoClientName(meeting.clientId),
      createdBy: 'Demo',
      createdAt: new Date().toISOString(),
      recordings: [],
    };
    demoMeetings = [nextMeeting, ...demoMeetings];
    return cloneMeeting(nextMeeting);
  }

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
  if (isUsingDemoMeetings) {
    let updatedMeeting = null;
    demoMeetings = demoMeetings.map((currentMeeting) => {
      if (currentMeeting.id !== meetingId) {
        return currentMeeting;
      }

      updatedMeeting = {
        ...currentMeeting,
        title: meeting.title,
        meetingAt: meeting.meetingAt || '',
        clientId: meeting.clientId || '',
        clientName: demoClientName(meeting.clientId),
      };
      return updatedMeeting;
    });
    return cloneMeeting(updatedMeeting);
  }

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
  if (isUsingDemoMeetings) {
    demoMeetings = demoMeetings.filter((meeting) => meeting.id !== meetingId);
    return String(meetingId);
  }

  await apiRequest(`/api/reunioes/${meetingId}/excluir/`, {
    method: 'DELETE',
  });
  return String(meetingId);
}

export async function uploadRecording(meetingId, recording) {
  if (isUsingDemoMeetings) {
    const nextRecording = {
      id: nextDemoId('demo-recording'),
      filename: recording.filename,
      contentType: recording.blob?.type || '',
      size: recording.blob?.size || 0,
      status: 'concluida',
      statusLabel: 'Concluida',
      transcript: '',
      summary: '## Resumo\nAudio demo recebido. Edite a transcricao para simular a revisao do conteudo.',
      provider: 'demo',
      transcriptionModel: 'Demo transcript',
      summaryModel: 'Demo summary',
      processingError: '',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    demoMeetings = demoMeetings.map((meeting) => (
      meeting.id === meetingId
        ? { ...meeting, recordings: [nextRecording, ...meeting.recordings] }
        : meeting
    ));

    return cloneRecording(nextRecording);
  }

  const data = new FormData();
  data.append('audio', recording.blob, recording.filename);

  const payload = await apiRequest(`/api/reunioes/${meetingId}/gravacoes/`, {
    method: 'POST',
    body: data,
  });
  return recordingFromApi(payload.gravacao);
}

export async function getRecording(recordingId) {
  if (isUsingDemoMeetings) {
    const recording = demoMeetings
      .flatMap((meeting) => meeting.recordings)
      .find((currentRecording) => currentRecording.id === recordingId);
    return recording ? cloneRecording(recording) : null;
  }

  const payload = await apiRequest(`/api/reunioes/gravacoes/${recordingId}/`);
  return recordingFromApi(payload.gravacao);
}

export async function updateRecording(recordingId, recording) {
  if (isUsingDemoMeetings) {
    let updatedRecording = null;
    demoMeetings = demoMeetings.map((meeting) => ({
      ...meeting,
      recordings: meeting.recordings.map((currentRecording) => {
        if (currentRecording.id !== recordingId) {
          return currentRecording;
        }

        updatedRecording = { ...currentRecording, transcript: recording.transcript };
        return updatedRecording;
      }),
    }));
    return cloneRecording(updatedRecording);
  }

  const payload = await apiRequest(`/api/reunioes/gravacoes/${recordingId}/editar/`, {
    method: 'PATCH',
    body: JSON.stringify({
      transcricao: recording.transcript,
    }),
  });
  return recordingFromApi(payload.gravacao);
}

export async function deleteRecording(recordingId) {
  if (isUsingDemoMeetings) {
    demoMeetings = demoMeetings.map((meeting) => ({
      ...meeting,
      recordings: meeting.recordings.filter((recording) => recording.id !== recordingId),
    }));
    return String(recordingId);
  }

  await apiRequest(`/api/reunioes/gravacoes/${recordingId}/excluir/`, {
    method: 'DELETE',
  });
  return String(recordingId);
}
