import { describe, expect, it } from 'vitest';

import {
  MULTIPART_FALLBACK_MAX_BYTES,
  chooseUploadStrategy,
  recordingFromApi,
} from './meetings';

describe('chooseUploadStrategy', () => {
  it('uses the Drive flow when the session was created', () => {
    expect(chooseUploadStrategy({ sessionErrorStatus: null, blobSize: 10 * 1024 * 1024 })).toBe('drive');
  });

  it('falls back to multipart only on 503 with a small blob', () => {
    expect(
      chooseUploadStrategy({ sessionErrorStatus: 503, blobSize: MULTIPART_FALLBACK_MAX_BYTES }),
    ).toBe('multipart');
    expect(
      chooseUploadStrategy({ sessionErrorStatus: 503, blobSize: MULTIPART_FALLBACK_MAX_BYTES + 1 }),
    ).toBe('fail');
  });

  it('fails on auth and validation errors', () => {
    expect(chooseUploadStrategy({ sessionErrorStatus: 401, blobSize: 100 })).toBe('fail');
    expect(chooseUploadStrategy({ sessionErrorStatus: 400, blobSize: 100 })).toBe('fail');
  });
});

describe('recordingFromApi', () => {
  it('maps the API record including drive_file_id', () => {
    const recording = recordingFromApi({
      id: 9,
      drive_file_id: 'file-1',
      nome_original: 'reuniao.webm',
      mime_type: 'audio/webm',
      tamanho_bytes: '1000',
      status: 'enviada',
      status_label: 'Enviada',
      erro_processamento: '',
    });

    expect(recording).toMatchObject({
      id: '9',
      driveFileId: 'file-1',
      filename: 'reuniao.webm',
      contentType: 'audio/webm',
      size: 1000,
      status: 'enviada',
      statusLabel: 'Enviada',
    });
  });

  it('returns null for null input', () => {
    expect(recordingFromApi(null)).toBeNull();
  });
});
