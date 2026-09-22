import { Injectable } from '@nestjs/common';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { assertSafeStorageKey, StorageAdapter } from './storage.service';

// Local storage resolves opaque keys beneath one configured root and rejects escapes after normalization.
@Injectable()
export class LocalStorageAdapter extends StorageAdapter {
  private readonly root: string;

  constructor(root: string) {
    super();
    this.root = resolve(root);
  }

  async put(key: string, bytes: Buffer, _mimeType: string): Promise<void> {
    const path = this.resolveKey(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes, { flag: 'wx', mode: 0o600 });
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolveKey(key));
      return true;
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') return false;
      throw error;
    }
  }

  // This is reserved for compensating an interrupted technical write, never a clinical void.
  async deleteForRollback(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  private resolveKey(key: string): string {
    assertSafeStorageKey(key);
    const path = resolve(this.root, ...key.split('/'));
    const pathFromRoot = relative(this.root, path);
    if (isAbsolute(pathFromRoot) || pathFromRoot === '..' || pathFromRoot.startsWith(`..${sep}`)) {
      throw new Error('Storage key escapes configured root');
    }
    return path;
  }
}
