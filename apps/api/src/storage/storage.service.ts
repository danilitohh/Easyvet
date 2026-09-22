import { Injectable } from '@nestjs/common';

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

// Storage abstracts opaque private object keys; clinical deletion is never exposed to domain callers.
export interface StorageService {
  put(key: string, bytes: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  deleteForRollback(key: string): Promise<void>;
}

@Injectable()
export abstract class StorageAdapter implements StorageService {
  abstract put(key: string, bytes: Buffer, mimeType: string): Promise<void>;
  abstract get(key: string): Promise<Buffer>;
  abstract exists(key: string): Promise<boolean>;
  abstract deleteForRollback(key: string): Promise<void>;
}

// Storage keys are always internal identifiers, never user-provided filenames or paths.
export function assertSafeStorageKey(key: string): void {
  if (
    key.length === 0 ||
    key.length > 500 ||
    key.startsWith('/') ||
    key.includes('\\') ||
    key.split('/').some((part) => part === '' || part === '.' || part === '..') ||
    !/^[a-zA-Z0-9/_.-]+$/.test(key)
  ) {
    throw new Error('Invalid internal storage key');
  }
}

// Generates tenant-prefixed keys from validated UUIDs and a fixed allowlist of extensions.
export function createStorageKey(
  organizationId: string,
  artifactId: string,
  extension: 'pdf' | 'png' | 'jpg',
): string {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(organizationId) || !uuid.test(artifactId)) {
    throw new Error('Storage keys require UUID identifiers');
  }
  return `${organizationId}/${artifactId}.${extension}`;
}
