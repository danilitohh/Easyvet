import { afterEach, describe, expect, it } from '@jest/globals';
import { validateEnvironment } from './env';

describe('environment storage configuration', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  const base = {
    DATABASE_URL: 'postgresql://easyvet:local-only@localhost:5432/easyvet',
    APP_ORIGIN: 'https://easyvet.example',
  };

  it('keeps local development on local storage by default', () => {
    expect(validateEnvironment(base).STORAGE_DRIVER).toBe('local');
  });

  it('selects Supabase Storage on Vercel and requires server credentials', () => {
    expect(() => validateEnvironment({ ...base, VERCEL: '1' })).toThrow(
      'SUPABASE_URL is required when STORAGE_DRIVER=supabase',
    );

    const config = validateEnvironment({
      ...base,
      VERCEL: '1',
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'server-only-test-secret',
    });

    expect(config.STORAGE_DRIVER).toBe('supabase');
    expect(config.SUPABASE_STORAGE_BUCKET).toBe('easyvet-clinical-documents');
  });

  it('fails closed if local storage is explicitly selected on Vercel', () => {
    expect(() => validateEnvironment({ ...base, VERCEL: '1', STORAGE_DRIVER: 'local' })).toThrow(
      'Local file storage is not persistent or writable on Vercel',
    );
  });
});
