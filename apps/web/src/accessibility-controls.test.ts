import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(tsx|jsx)$/.test(entry.name) ? [path] : [];
  });
}

function readStyleBlock(source: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
}

describe('accessible shared controls', () => {
  it('requires an accessible name on every icon-only button', () => {
    const files = sourceFiles(join(process.cwd(), 'src'));
    const unnamedButtons: string[] = [];
    const openingButtonPattern = /<button\b[^>]*>/g;

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(openingButtonPattern)) {
        const openingTag = match[0];
        if (/\bicon-button\b/.test(openingTag) && !/\baria-label\s*=/.test(openingTag)) {
          unnamedButtons.push(file);
        }
      }
    }

    expect(unnamedButtons).toEqual([]);
  });

  it('keeps shared icon buttons and focus states usable by touch and keyboard', () => {
    const styles = readFileSync(join(process.cwd(), 'src/styles/index.css'), 'utf8');
    const iconButtonStyles = readStyleBlock(styles, '.icon-button');
    const width = Number(iconButtonStyles.match(/\bwidth:\s*(\d+)px/)?.[1] ?? 0);
    const height = Number(iconButtonStyles.match(/\bheight:\s*(\d+)px/)?.[1] ?? 0);

    expect(width).toBeGreaterThanOrEqual(24);
    expect(height).toBeGreaterThanOrEqual(24);
    expect(styles).toMatch(/button:focus-visible[\s\S]*?outline:\s*3px/);
    expect(styles).toMatch(/a:focus-visible[\s\S]*?outline:\s*3px/);
  });
});
