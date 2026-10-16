import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(join(process.cwd(), 'src', 'styles', 'tokens.css'), 'utf8');

function token(name: string): string {
  const match = tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6});`));
  if (!match?.[1]) throw new Error(`Missing color token --${name}`);
  return match[1];
}

function relativeLuminance(hex: string): number {
  const channels = hex.match(/[0-9a-f]{2}/gi)?.map((channel) => parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) throw new Error(`Invalid CSS color: ${hex}`);

  const linear = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contrastRatio(foreground: string, background: string): number {
  const luminances = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  );
  return (luminances[0]! + 0.05) / (luminances[1]! + 0.05);
}

describe('Easyvet text contrast tokens', () => {
  it('keeps muted text at WCAG AA contrast on core light surfaces', () => {
    const muted = token('color-ink-muted');
    const lightSurfaces = [
      'color-surface',
      'color-canvas',
      'color-surface-soft',
      'color-brand-soft',
    ];

    for (const surface of lightSurfaces) {
      expect(
        contrastRatio(muted, token(surface)),
        `${muted} on --${surface}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
