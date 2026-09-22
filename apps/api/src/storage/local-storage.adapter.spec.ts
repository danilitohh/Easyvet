import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import { LocalStorageAdapter } from './local-storage.adapter';
import { assertSafeStorageKey, createStorageKey } from './storage.service';

// Local storage tests isolate all bytes under a temporary directory and never inspect real clinical data.
describe('private local document storage', () => {
  let directory: string | undefined;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
    directory = undefined;
  });

  it('writes and reads tenant-prefixed opaque keys without overwriting existing artifacts', async () => {
    directory = await mkdtemp(join(tmpdir(), 'easyvet-storage-'));
    const storage = new LocalStorageAdapter(directory);
    const key = createStorageKey(
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      'pdf',
    );
    const bytes = Buffer.from('%PDF-1.7 local test');

    await storage.put(key, bytes, 'application/pdf');

    expect(await storage.exists(key)).toBe(true);
    expect(await storage.get(key)).toEqual(bytes);
    await expect(storage.put(key, Buffer.from('replacement'), 'application/pdf')).rejects.toThrow();
  });

  it('rejects traversal and absolute paths before resolving them under the configured root', async () => {
    directory = await mkdtemp(join(tmpdir(), 'easyvet-storage-'));
    const storage = new LocalStorageAdapter(directory);

    expect(() => assertSafeStorageKey('../outside.pdf')).toThrow('Invalid internal storage key');
    await expect(
      storage.put('../outside.pdf', Buffer.from('no'), 'application/pdf'),
    ).rejects.toThrow('Invalid internal storage key');
  });

  it('uses delete only for an explicit technical rollback and reports missing objects safely', async () => {
    directory = await mkdtemp(join(tmpdir(), 'easyvet-storage-'));
    const storage = new LocalStorageAdapter(directory);
    const key = createStorageKey(
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000003',
      'png',
    );
    await storage.put(key, Buffer.from('signature'), 'image/png');
    await storage.deleteForRollback(key);

    expect(await storage.exists(key)).toBe(false);
    await expect(readFile(join(directory, key))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
