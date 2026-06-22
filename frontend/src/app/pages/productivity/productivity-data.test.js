import { describe, expect, it } from 'vitest';

import {
  computeDeliverables,
  formatHoursCompact,
  periodBounds,
  variationPercent,
} from './productivity-data';

// ---------------------------------------------------------------------------
// formatHoursCompact
// ---------------------------------------------------------------------------

describe('formatHoursCompact', () => {
  it('returns 0h for zero', () => expect(formatHoursCompact(0)).toBe('0h'));
  it('returns hours only when no leftover minutes', () => expect(formatHoursCompact(7200)).toBe('2h'));
  it('returns minutes only when under an hour', () => expect(formatHoursCompact(1800)).toBe('30m'));
  it('returns combined h and m', () => expect(formatHoursCompact(5400)).toBe('1h 30m'));
  it('handles non-number gracefully', () => expect(formatHoursCompact(null)).toBe('0h'));
  it('floors seconds — 3659s = 1h', () => expect(formatHoursCompact(3659)).toBe('1h'));
  it('floors seconds — 3660s = 1h 1m', () => expect(formatHoursCompact(3660)).toBe('1h 1m'));
});

// ---------------------------------------------------------------------------
// periodBounds
// ---------------------------------------------------------------------------

describe('periodBounds', () => {
  it('week period: start is Monday, end is today', () => {
    const { start, end } = periodBounds('week');
    expect(start.getDay()).toBe(1); // Monday
    expect(start.getHours()).toBe(0);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });

  it('month period: start is 1st of month', () => {
    const { start } = periodBounds('month');
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);
  });

  it('custom period: parses customStart and customEnd as local noon to avoid TZ shifts', () => {
    const { start, end } = periodBounds('custom', '2025-01-15', '2025-01-20');
    expect(start.getDate()).toBe(15);
    expect(end.getDate()).toBe(20);
  });

  it('custom with missing dates returns null bounds', () => {
    const { start, end } = periodBounds('custom', '', '');
    expect(start).toBeNull();
    expect(end).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// variationPercent
// ---------------------------------------------------------------------------

describe('variationPercent', () => {
  it('returns null when previous is 0', () => expect(variationPercent(100, 0)).toBeNull());
  it('calculates positive variation', () => expect(variationPercent(150, 100)).toBe(50));
  it('calculates negative variation', () => expect(variationPercent(80, 100)).toBe(-20));
  it('rounds to 1 decimal', () => expect(variationPercent(1, 3)).toBe(-66.7));
});

// ---------------------------------------------------------------------------
// computeDeliverables
// ---------------------------------------------------------------------------

const BOUNDS = {
  start: new Date('2025-01-01T00:00:00'),
  end: new Date('2025-01-31T23:59:59'),
};

// isDeadlineDone: completed=true OR status in ['protocolar','protocolado']
const mockDeadline = (overrides = {}) => ({
  id: '1', completed: true, responsible: 'u1',
  atualizado_em: '2025-01-15T10:00:00', ...overrides,
});

// isPetitionDone: status in ['protocolar','protocolado']
const mockPetition = (overrides = {}) => ({
  id: '2', status: 'protocolado', responsible: 'u1',
  atualizado_em: '2025-01-20T10:00:00', ...overrides,
});

// isEventAttended: completed=true OR start < now
const mockEvent = (overrides = {}) => ({
  id: '3', responsibleName: 'u1', completed: true,
  start: '2025-01-10T10:00:00', ...overrides,
});

describe('computeDeliverables', () => {
  const collections = {
    deadlines: [mockDeadline()],
    petitions: [mockPetition()],
    events: [mockEvent()],
    user: null,
    now: Date.now(),
  };

  it('counts all done items when user is null (no filter)', () => {
    const result = computeDeliverables(BOUNDS, collections);
    expect(result.doneDeadlines).toHaveLength(1);
    expect(result.donePetitions).toHaveLength(1);
    expect(result.attendedEvents).toHaveLength(1);
  });

  it('excludes items outside bounds', () => {
    const outdated = {
      deadlines: [mockDeadline({ atualizado_em: '2024-12-15T10:00:00' })],
      petitions: [],
      events: [],
      user: null,
      now: Date.now(),
    };
    const result = computeDeliverables(BOUNDS, outdated);
    expect(result.doneDeadlines).toHaveLength(0);
  });

  it('excludes non-done items', () => {
    const pending = {
      deadlines: [mockDeadline({ completed: false, status: 'pendente' })],
      petitions: [mockPetition({ status: 'em_andamento' })],
      events: [],
      user: null,
      now: Date.now(),
    };
    const result = computeDeliverables(BOUNDS, pending);
    expect(result.doneDeadlines).toHaveLength(0);
    expect(result.donePetitions).toHaveLength(0);
  });
});
