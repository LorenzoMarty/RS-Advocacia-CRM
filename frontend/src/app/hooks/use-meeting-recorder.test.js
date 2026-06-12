import { describe, expect, it } from 'vitest';

import {
  MAX_RECORDING_BYTES,
  formatRemaining,
  validateRecordingSize,
} from './use-meeting-recorder';

describe('validateRecordingSize', () => {
  it('rejects empty and missing blobs', () => {
    expect(validateRecordingSize(null)).not.toBe('');
    expect(validateRecordingSize({ size: 0 })).not.toBe('');
  });

  it('accepts blobs up to the limit and rejects above it', () => {
    expect(validateRecordingSize({ size: MAX_RECORDING_BYTES })).toBe('');
    expect(validateRecordingSize({ size: MAX_RECORDING_BYTES + 1 })).toContain('25 MB');
  });
});

describe('formatRemaining', () => {
  it('formats minutes and zero-padded seconds', () => {
    expect(formatRemaining(20 * 60 * 1000)).toBe('20:00');
    expect(formatRemaining(61_000)).toBe('1:01');
    expect(formatRemaining(0)).toBe('0:00');
    expect(formatRemaining(-5)).toBe('0:00');
  });
});
