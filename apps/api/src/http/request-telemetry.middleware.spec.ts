import { ConfigService } from '@nestjs/config';
import { describe, expect, it, jest } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';
import { Logger } from '@nestjs/common';
import { RequestTelemetryMiddleware, safeRequestPath } from './request-telemetry.middleware';

describe('RequestTelemetryMiddleware', () => {
  function setup(thresholdMs = 1_000) {
    const finishHandlers: Array<() => void> = [];
    const request = {
      method: 'GET',
      path: '/api/v1/patients/550e8400-e29b-41d4-a716-446655440000',
      header: jest.fn().mockReturnValue('request-123'),
    } as unknown as Request;
    const response = {
      statusCode: 200,
      once: jest.fn((_event: string, handler: () => void) => finishHandlers.push(handler)),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;
    const config = new ConfigService({ SLOW_REQUEST_LOG_MS: thresholdMs });
    const middleware = new RequestTelemetryMiddleware(
      config as unknown as ConfigService<never, true>,
    );
    middleware.use(request, response, next);
    return { finishHandlers, next, request, response, middleware };
  }

  it('does not log requests below the configured threshold', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { finishHandlers, next } = setup(1_000);

    finishHandlers[0]?.();

    expect(next).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('logs only safe slow-request metadata', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { finishHandlers, request, response } = setup(100);
    Object.defineProperty(request, 'path', {
      value: '/api/v1/patients/550e8400-e29b-41d4-a716-446655440000?email=patient@example.com',
    });
    Object.defineProperty(response, 'statusCode', { value: 503 });
    const startedAt = process.hrtime.bigint();
    while (Number(process.hrtime.bigint() - startedAt) / 1_000_000 < 110) {
      // Allow the monotonic clock to advance without sleeping in the test.
    }

    finishHandlers[0]?.();

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'slow_request',
        requestId: 'request-123',
        method: 'GET',
        path: '/api/v1/patients/:param',
        statusCode: 503,
        thresholdMs: 100,
      }),
    );
    expect(JSON.stringify(warn.mock.calls[0])).not.toContain('patient@example.com');
    warn.mockRestore();
  });

  it('uses the route template when Express has resolved one', () => {
    const request = {
      path: '/api/v1/patients/secret-id',
      route: { path: '/api/v1/patients/:id' },
    } as Request;

    expect(safeRequestPath(request)).toBe('/api/v1/patients/:id');
  });
});
