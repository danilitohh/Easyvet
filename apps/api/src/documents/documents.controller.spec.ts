import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import { CLINICAL_DOCUMENT_UPLOAD_LIMITS, DocumentsController } from './documents.controller';
import { RATE_LIMIT_POLICY_KEY, RateLimitRule } from '../http/rate-limit.decorator';

describe('DocumentsController rate limits', () => {
  it('limits clinical document uploads by client IP', () => {
    const rules = Reflect.getMetadata(
      RATE_LIMIT_POLICY_KEY,
      DocumentsController.prototype.upload,
    ) as RateLimitRule[];

    expect(rules).toEqual([
      {
        name: 'documents.upload.ip',
        identity: 'ip',
        limit: 20,
        windowMs: 15 * 60_000,
      },
    ]);
  });

  it('bounds the file and multipart fields', () => {
    expect(CLINICAL_DOCUMENT_UPLOAD_LIMITS).toEqual({
      fileSize: 10 * 1024 * 1024,
      files: 1,
      fields: 4,
      fieldSize: 16 * 1024,
      fieldNameSize: 100,
    });
  });
});
