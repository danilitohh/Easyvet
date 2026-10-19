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

  it('renders a branded password recovery email with a secure fallback link', async () => {
    const config = {
      get: jest.fn((key: keyof Environment) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'RESEND_API_KEY') return 're_test_key';
        if (key === 'RESEND_FROM_EMAIL') return 'Easyvet <no-reply@example.test>';
        return undefined;
      }),
    } as unknown as ConfigService<Environment, true>;
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true, status: 200 } as Response);
    const service = new AccountEmailService(config);

    await service.sendPasswordReset(
      'owner@example.test',
      'https://easyvet.test/restablecer-contrasena/secret-token',
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, request] = fetch.mock.calls[0] ?? [];
    const payload = JSON.parse(String(request?.body));
    expect(payload.subject).toBe('Restablece tu contraseña de Easyvet');
    expect(payload.html).toContain('SEGURIDAD DE TU CUENTA');
    expect(payload.html).toContain('Tiempo limitado');
    expect(payload.html).toContain('Restablecer contraseña');
    expect(payload.html).toContain('secret-token');
    expect(payload.text).toContain('Si no solicitaste este cambio');

    fetch.mockRestore();
  });
});
