import { describe, expect, it } from 'vitest';
import { MODULE_ROUTES } from './navigation';

describe('operational navigation icons', () => {
  it('uses source-owned SVG names instead of text glyphs', () => {
    expect(MODULE_ROUTES).not.toHaveLength(0);
    expect(MODULE_ROUTES.every((route) => /^[a-z-]+$/.test(route.icon))).toBe(true);
    expect(MODULE_ROUTES.map((route) => route.icon)).not.toContain('⌂');
    expect(MODULE_ROUTES.map((route) => route.icon)).not.toContain('⚙');
  });
});
