import { describe, expect, it, jest } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import type { Environment } from '../config/env';
import { CsrfOriginMiddleware } from './csrf-origin.middleware';

// This regression suite keeps multipart open only on the two narrowly scoped upload endpoints.
describe('CSRF and multipart boundary', () => {
  const config = {
    get: jest.fn().mockReturnValue('http://localhost:5173'),
  } as unknown as ConfigService<Environment, true>;
  const middleware = new CsrfOriginMiddleware(config);

  // Supplies a representative request and records whether the security boundary rejects or passes it.
  function invoke(path: string, contentType: string) {
    const request = {
      method: 'POST',
      path: '/',
      originalUrl: path,
      headers: { 'content-type': contentType, origin: 'http://localhost:5173' },
    } as unknown as Request;
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    middleware.use(request, response, next);
    return { response, next };
  }

  it.each([
    '/api/v1/patients/00000000-0000-4000-8000-000000000401/documents',
    '/patients/00000000-0000-4000-8000-000000000401/documents',
    '/api/v1/public/signatures/test-token/sign',
    '/api/v1/public/signatures/test-token/sign?source=qa',
    '/public/signatures/test-token/sign',
  ])('accepts multipart only on the configured upload route %s', (path) => {
    const { response, next } = invoke(path, 'multipart/form-data; boundary=qa-boundary');

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('rejects multipart on unrelated mutation routes', () => {
    const { response, next } = invoke('/public/profile', 'multipart/form-data; boundary=qa');

    expect(response.status).toHaveBeenCalledWith(415);
    expect(next).not.toHaveBeenCalled();
  });
});
