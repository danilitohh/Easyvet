import { describe, expect, it } from '@jest/globals';
import { RATE_LIMIT_POLICY_KEY } from '../http/rate-limit.decorator';
import { AuthController } from './auth.controller';

describe('AuthController rate limits', () => {
  it('limits authenticated password-change attempts by IP', () => {
    expect(
      Reflect.getMetadata(RATE_LIMIT_POLICY_KEY, AuthController.prototype.changePassword),
    ).toEqual([
      {
        name: 'auth.change-password.ip',
        identity: 'ip',
        limit: 10,
        windowMs: 15 * 60_000,
      },
    ]);
  });
});
