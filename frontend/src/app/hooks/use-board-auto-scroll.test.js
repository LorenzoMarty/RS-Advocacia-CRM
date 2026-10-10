import { describe, expect, it } from 'vitest';

import { edgeDirection } from './use-board-auto-scroll';

const rect = { left: 100, right: 500 };

describe('edgeDirection', () => {
  it('scrolls left near the left edge', () => {
    expect(edgeDirection(100, rect, 72)).toBe(-1);
    expect(edgeDirection(171, rect, 72)).toBe(-1);
  });

  it('scrolls right near the right edge', () => {
    expect(edgeDirection(500, rect, 72)).toBe(1);
    expect(edgeDirection(429, rect, 72)).toBe(1);
  });

  it('does not scroll in the middle or exactly at the thresholds', () => {
    expect(edgeDirection(300, rect, 72)).toBe(0);
    expect(edgeDirection(172, rect, 72)).toBe(0);
    expect(edgeDirection(428, rect, 72)).toBe(0);
  });
});
