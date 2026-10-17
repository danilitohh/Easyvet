import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { SupabaseStorageAdapter } from './supabase-storage.adapter';
import { createStorageKey } from './storage.service';

const remoteStorageTestEnabled =
  process.env.RUN_REMOTE_STORAGE_TESTS === '1' &&
  process.env.REMOTE_STORAGE_TEST_CONFIRM === 'EASYVET_REMOTE_STORAGE_SYNTHETIC_OK';

const describeRemote = remoteStorageTestEnabled ? describe : describe.skip;

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the opt-in remote Storage test`);
  return value;
}

describeRemote('opt-in Supabase Storage synthetic smoke test', () => {
  const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const artifactId = randomUUID();
  const key = createStorageKey(organizationId, artifactId, 'pdf');
  const bytes = Buffer.from('%PDF-1.7 EASYVET SYNTHETIC STORAGE TEST\n', 'utf8');
  let adapter: SupabaseStorageAdapter;
  let uploaded = false;

  beforeAll(() => {
    adapter = new SupabaseStorageAdapter({
      url: requiredEnvironment('SUPABASE_URL'),
      serviceRoleKey: requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY'),
      bucket: process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'easyvet-clinical-documents',
    });
  });

  afterAll(async () => {
    if (uploaded) await adapter.deleteForRollback(key);
  });

  it('uploads, reads, verifies and removes only the synthetic object', async () => {
    await adapter.put(key, bytes, 'application/pdf');
    uploaded = true;

    await expect(adapter.exists(key)).resolves.toBe(true);
    await expect(adapter.get(key)).resolves.toEqual(bytes);

    await adapter.deleteForRollback(key);
    uploaded = false;
    await expect(adapter.exists(key)).resolves.toBe(false);
  });
});
