import { describe, expect, it } from 'vitest';

import { cn } from '@/lib/utils';

import { buttonVariants } from './button-variants';

// A altura vem de tokens responsivos (--ctl-h), não de classes por breakpoint: um className do
// chamador (ex.: h-12) precisa vencer em qualquer largura.
describe('buttonVariants density', () => {
  it('uses the density token, without per-breakpoint height classes', () => {
    const classes = buttonVariants({ size: 'default' });
    expect(classes).toContain('h-[var(--ctl-h)]');
    expect(classes).not.toContain('max-[1024px]');
  });

  it('lets a caller height override the token', () => {
    const merged = cn(buttonVariants({ size: 'default' }), 'h-12');
    expect(merged).toContain('h-12');
    expect(merged).not.toContain('h-[var(--ctl-h)]');
  });

  it('maps sm and icon to their own tokens', () => {
    expect(buttonVariants({ size: 'sm' })).toContain('h-[var(--ctl-h-sm)]');
    expect(buttonVariants({ size: 'icon' })).toContain('size-[var(--ctl-h)]');
  });
});
