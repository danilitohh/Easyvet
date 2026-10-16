import { describe, expect, it } from '@jest/globals';
import { RATE_LIMIT_POLICY_KEY } from '../http/rate-limit.decorator';
import { PublicSignaturesController } from './public-signatures.controller';

describe('PublicSignaturesController rate limits', () => {
  it('limits public consent reads and signatures by IP and token', () => {
    expect(
      Reflect.getMetadata(RATE_LIMIT_POLICY_KEY, PublicSignaturesController.prototype.get),
    ).toEqual([
      { name: 'public-signature.read.ip', identity: 'ip', limit: 60, windowMs: 60_000 },
      { name: 'public-signature.read.token', identity: 'token', limit: 20, windowMs: 60_000 },
    ]);

    expect(
      Reflect.getMetadata(RATE_LIMIT_POLICY_KEY, PublicSignaturesController.prototype.sign),
    ).toEqual([
      { name: 'public-signature.sign.ip', identity: 'ip', limit: 10, windowMs: 60 * 60_000 },
      { name: 'public-signature.sign.token', identity: 'token', limit: 5, windowMs: 60 * 60_000 },
    ]);
  });
});
