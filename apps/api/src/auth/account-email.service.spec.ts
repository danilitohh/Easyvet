import { describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/env';
import { AccountEmailService } from './account-email.service';

describe('AccountEmailService', () => {
  it('never logs account action links when local email delivery is unavailable', async () => {
    const config = {
      get: jest.fn((key: keyof Environment) => {
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      }),
    } as unknown as ConfigService<Environment, true>;
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const service = new AccountEmailService(config);

    await service.sendPasswordReset(
      'owner@example.test',
      'https://easyvet.test/reset/secret-token',
    );

    expect(warn).toHaveBeenCalledWith(
      'Account email provider is not configured; action link omitted from logs.',
    );
    expect(warn.mock.calls.flat().join(' ')).not.toContain('secret-token');
    warn.mockRestore();
  });
});
