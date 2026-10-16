import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Injectable } from '@nestjs/common';
import { assertSafeStorageKey, StorageAdapter } from './storage.service';

export type SupabaseStorageOptions = {
  url: string;
  serviceRoleKey: string;
  bucket: string;
};

// Private bucket access stays server-side; domain services still authorize every tenant operation.
@Injectable()
export class SupabaseStorageAdapter extends StorageAdapter {
  private readonly client: SupabaseClient;

  constructor(
    private readonly options: SupabaseStorageOptions,
    client?: SupabaseClient,
  ) {
    super();
    this.client =
      client ??
      createClient(options.url, options.serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      });
  }

  async put(key: string, bytes: Buffer, mimeType: string): Promise<void> {
    assertSafeStorageKey(key);
    const { error } = await this.client.storage.from(this.options.bucket).upload(key, bytes, {
      contentType: mimeType,
      cacheControl: '0',
      upsert: false,
    });
    if (error) throw new Error('Supabase Storage upload failed');
  }

  async get(key: string): Promise<Buffer> {
    assertSafeStorageKey(key);
    const { data, error } = await this.client.storage.from(this.options.bucket).download(key);
    if (error || !data) throw new Error('Supabase Storage download failed');
    return Buffer.from(await data.arrayBuffer());
  }

  async exists(key: string): Promise<boolean> {
    assertSafeStorageKey(key);
    const segments = key.split('/');
    const filename = segments.pop();
    const folder = segments.join('/');
    if (!filename) throw new Error('Invalid internal storage key');

    const { data, error } = await this.client.storage.from(this.options.bucket).list(folder, {
      limit: 10,
      search: filename,
    });
    if (error || !data) throw new Error('Supabase Storage lookup failed');
    return data.some((object) => object.name === filename);
  }

  async deleteForRollback(key: string): Promise<void> {
    assertSafeStorageKey(key);
    const { error } = await this.client.storage.from(this.options.bucket).remove([key]);
    if (error) throw new Error('Supabase Storage rollback cleanup failed');
  }
}
