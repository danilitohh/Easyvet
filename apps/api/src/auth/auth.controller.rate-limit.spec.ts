import { describe, expect, it } from '@jest/globals';
import { RATE_LIMIT_POLICY_KEY } from '../http/rate-limit.decorator';
import { AuthController } from './auth.controller';

describe('AuthController rate limits', () => {
  it('keeps rate limits on every sensitive authentication flow', () => {
    const policies = [
      {
        handler: AuthController.prototype.login,
        expected: [
          { name: 'auth.login.ip', identity: 'ip', limit: 30, windowMs: 15 * 60_000 },
          {
            name: 'auth.login.failure.email',
            identity: 'email',
            limit: 5,
            windowMs: 15 * 60_000,
            mode: 'check',
          },
        ],
      },
      {
        handler: AuthController.prototype.register,
        expected: [
          { name: 'auth.register.ip', identity: 'ip', limit: 8, windowMs: 60 * 60_000 },
          { name: 'auth.register.email', identity: 'email', limit: 3, windowMs: 60 * 60_000 },
        ],
      },
      {
        handler: AuthController.prototype.bootstrapPlatformAdmin,
        expected: [{ name: 'auth.bootstrap.ip', identity: 'ip', limit: 5, windowMs: 60 * 60_000 }],
      },
      {
        handler: AuthController.prototype.verifyEmail,
        expected: [
          { name: 'auth.verify-email.ip', identity: 'ip', limit: 20, windowMs: 60 * 60_000 },
          {
            name: 'auth.verify-email.token',
            identity: 'token',
            limit: 5,
            windowMs: 60 * 60_000,
          },
        ],
      },
      {
        handler: AuthController.prototype.resendVerification,
        expected: [
          {
            name: 'auth.resend-verification.ip',
            identity: 'ip',
            limit: 10,
            windowMs: 60 * 60_000,
          },
          {
            name: 'auth.resend-verification.email',
            identity: 'email',
            limit: 3,
            windowMs: 60 * 60_000,
          },
        ],
      },
      {
        handler: AuthController.prototype.requestPasswordReset,
        expected: [
          {
            name: 'auth.password-reset-request.ip',
            identity: 'ip',
            limit: 10,
            windowMs: 60 * 60_000,
          },
          {
            name: 'auth.password-reset-request.email',
            identity: 'email',
            limit: 3,
            windowMs: 60 * 60_000,
          },
        ],
      },
      {
        handler: AuthController.prototype.resetPassword,
        expected: [
          {
            name: 'auth.password-reset-confirm.ip',
            identity: 'ip',
            limit: 10,
            windowMs: 60 * 60_000,
          },
          {
            name: 'auth.password-reset-confirm.token',
            identity: 'token',
            limit: 5,
            windowMs: 60 * 60_000,
          },
        ],
      },
      {
        handler: AuthController.prototype.realtimeToken,
        expected: [
          { name: 'auth.realtime-token.user', identity: 'user', limit: 60, windowMs: 15 * 60_000 },
        ],
      },
      {
        handler: AuthController.prototype.switchOrganization,
        expected: [
          {
            name: 'auth.switch-organization.user',
            identity: 'user',
            limit: 20,
            windowMs: 15 * 60_000,
          },
        ],
      },
      {
        handler: AuthController.prototype.changePassword,
        expected: [
          {
            name: 'auth.change-password.ip',
            identity: 'ip',
            limit: 10,
            windowMs: 15 * 60_000,
          },
          {
            name: 'auth.change-password.user',
            identity: 'user',
            limit: 5,
            windowMs: 15 * 60_000,
          },
        ],
      },
    ];

    for (const { handler, expected } of policies) {
      expect(Reflect.getMetadata(RATE_LIMIT_POLICY_KEY, handler)).toEqual(expected);
    }
  });
});
