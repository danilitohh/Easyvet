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

  it('requires HTTPS for public and storage URLs in production', () => {
    expect(() =>
      validateEnvironment({
        ...base,
        NODE_ENV: 'production',
        APP_ORIGIN: 'http://easyvet.example',
      }),
    ).toThrow('APP_ORIGIN must use HTTPS in production');

    expect(() =>
      validateEnvironment({
        ...base,
        NODE_ENV: 'production',
        VERCEL: '1',
        SUPABASE_URL: 'http://project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'server-only-test-secret',
      }),
    ).toThrow('SUPABASE_URL must use HTTPS in production');

    expect(() =>
      validateEnvironment({
        ...base,
        NODE_ENV: 'production',
        STORAGE_DRIVER: 's3',
        STORAGE_S3_ENDPOINT: 'http://storage.example',
        STORAGE_S3_BUCKET: 'easyvet',
        STORAGE_S3_ACCESS_KEY: 'test-access-key',
        STORAGE_S3_SECRET_KEY: 'test-secret-key',
      }),
    ).toThrow('STORAGE_S3_ENDPOINT must use HTTPS in production');
  });
});
