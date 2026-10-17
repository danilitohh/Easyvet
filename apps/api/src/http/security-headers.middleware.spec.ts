import { describe, expect, it, jest } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import type { Environment } from '../config/env';
import { SecurityHeadersMiddleware } from './security-headers.middleware';

describe('SecurityHeadersMiddleware', () => {
  function createMiddleware(nodeEnv: Environment['NODE_ENV']) {
    const config = {
      get: jest.fn().mockReturnValue(nodeEnv),
    } as unknown as ConfigService<Environment, true>;
    const middleware = new SecurityHeadersMiddleware(config);
    const response = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn() as NextFunction;

    middleware.use({} as Request, response, next);
    return { response, next };
  }

  it('sets browser boundary headers and HSTS in production', () => {
    const { response, next } = createMiddleware('production');
    const setHeader = response.setHeader as jest.Mock;

    expect(setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
    expect(setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'",
    );
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(setHeader).toHaveBeenCalledWith(
      'Permissions-Policy',
      'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
    );
    expect(setHeader).toHaveBeenCalledWith(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not advertise HSTS outside production', () => {
    const { response } = createMiddleware('development');
    const setHeader = response.setHeader as jest.Mock;

    expect(setHeader).not.toHaveBeenCalledWith('Strict-Transport-Security', expect.any(String));
  });
});
