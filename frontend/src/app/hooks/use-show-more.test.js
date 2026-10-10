import { describe, expect, it } from 'vitest';

import { visibleWindow } from './use-show-more';

const items = (n) => Array.from({ length: n }, (_, i) => ({ id: `i${i}` }));

describe('visibleWindow', () => {
  it('returns the same array when everything fits', () => {
    const list = items(5);
    expect(visibleWindow(list, 10)).toBe(list);
    expect(visibleWindow(list, 5)).toBe(list);
  });

  it('cuts to the limit, keeping order', () => {
    expect(visibleWindow(items(25), 10).map((i) => i.id)).toEqual(items(10).map((i) => i.id));
  });

  it('keeps a pinned item visible even beyond the window', () => {
    const ids = visibleWindow(items(25), 10, 'i20').map((i) => i.id);
    expect(ids).toHaveLength(11);
    expect(ids.at(-1)).toBe('i20');
  });

  it('does not duplicate a pinned item already in the window', () => {
    expect(visibleWindow(items(25), 10, 'i3')).toHaveLength(10);
  });

  it('ignores an unknown pinned id', () => {
    expect(visibleWindow(items(25), 10, 'nope')).toHaveLength(10);
  });

  it('does not mutate the input', () => {
    const list = items(25);
    visibleWindow(list, 10, 'i20');
    expect(list).toHaveLength(25);
  });
});
