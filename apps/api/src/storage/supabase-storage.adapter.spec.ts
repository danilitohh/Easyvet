import { describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseStorageAdapter } from './supabase-storage.adapter';

describe('private Supabase document storage', () => {
  function makeAdapter() {
    const bucket = {
      upload: jest.fn(async () => ({ data: { path: 'org/document.pdf' }, error: null })),
      download: jest.fn(async () => ({
        data: new Blob([Buffer.from('%PDF-1.7 test')]),
        error: null,
      })),
      list: jest.fn(async () => ({ data: [{ name: 'document.pdf' }], error: null })),
      remove: jest.fn(async () => ({ data: [{ name: 'document.pdf' }], error: null })),
    };
    const client = {
      storage: { from: jest.fn(() => bucket) },
    } as unknown as SupabaseClient;
    const adapter = new SupabaseStorageAdapter(
      {
        url: 'https://project.supabase.co',
        serviceRoleKey: 'server-only-test-secret',
        bucket: 'easyvet-clinical-documents',
      },
      client,
    );
    return { adapter, bucket, client };
  }

  it('uploads with fixed, private-bucket paths and no overwrite', async () => {
    const { adapter, bucket, client } = makeAdapter();
    const bytes = Buffer.from('%PDF-1.7 test');

    await adapter.put('org/document.pdf', bytes, 'application/pdf');

    expect(client.storage.from).toHaveBeenCalledWith('easyvet-clinical-documents');
    expect(bucket.upload).toHaveBeenCalledWith('org/document.pdf', bytes, {
      contentType: 'application/pdf',
      cacheControl: '0',
      upsert: false,
    });
  });

  it('downloads bytes, finds an exact object, and removes only a rollback key', async () => {
    const { adapter, bucket } = makeAdapter();

    await expect(adapter.get('org/document.pdf')).resolves.toEqual(Buffer.from('%PDF-1.7 test'));
    await expect(adapter.exists('org/document.pdf')).resolves.toBe(true);
    expect(bucket.list).toHaveBeenCalledWith('org', { limit: 10, search: 'document.pdf' });
    await adapter.deleteForRollback('org/document.pdf');
    expect(bucket.remove).toHaveBeenCalledWith(['org/document.pdf']);
  });

  it('rejects unsafe keys and does not expose provider errors to callers', async () => {
    const { adapter, bucket } = makeAdapter();

    await expect(adapter.put('../outside.pdf', Buffer.from('x'), 'application/pdf')).rejects.toThrow(
      'Invalid internal storage key',
    );
    bucket.download.mockResolvedValue({ data: null, error: new Error('secret provider detail') });
    await expect(adapter.get('org/document.pdf')).rejects.toThrow(
      'Supabase Storage download failed',
    );
  });
});
