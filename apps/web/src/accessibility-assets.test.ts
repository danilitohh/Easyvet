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

describe('accessible image markup', () => {
  it('requires an explicit alt attribute on every JSX image', () => {
    const files = sourceFiles(join(process.cwd(), 'src'));
    const missingAlt: string[] = [];
    const imagePattern = /<img\b([\s\S]*?)\/?\s*>/g;

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(imagePattern)) {
        if (!/\balt\s*=/.test(match[1] ?? '')) missingAlt.push(file);
      }
    }

    expect(missingAlt).toEqual([]);
  });
});
