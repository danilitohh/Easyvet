import { ArgumentsHost, HttpException, Logger, NotFoundException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import type { Request, Response } from 'express';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  it('redacts public signature tokens and query values from error paths', () => {
    const responseBody = jest.fn();
    const response = {
      status: jest.fn().mockReturnThis(),
      json: responseBody,
      getHeader: jest.fn().mockReturnValue('request-123'),
    };
    const request = {
      originalUrl: '/api/v1/public/signatures/sample-token/sign?otp=sample-code',
      path: '/api/v1/public/signatures/sample-token/sign',
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response as unknown as Response,
        getRequest: () => request as unknown as Request,
      }),
    } as unknown as ArgumentsHost;

    new ApiExceptionFilter().catch(new NotFoundException('Signature unavailable'), host);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(responseBody).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Signature unavailable',
        path: '/api/v1/public/signatures/[redacted]/sign',
        requestId: 'request-123',
      }),
    );
    expect(JSON.stringify(responseBody.mock.calls)).not.toContain('sample-token');
    expect(JSON.stringify(responseBody.mock.calls)).not.toContain('sample-code');
  });

  it('preserves ordinary route paths', () => {
    const responseBody = jest.fn();
    const response = {
      status: jest.fn().mockReturnThis(),
      json: responseBody,
      getHeader: jest.fn().mockReturnValue('request-456'),
    };
    const request = {
      originalUrl: '/api/v1/patients/example-id?include=summary',
      path: '/api/v1/patients/example-id',
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response as unknown as Response,
        getRequest: () => request as unknown as Request,
      }),
    } as unknown as ArgumentsHost;

    new ApiExceptionFilter().catch(new NotFoundException('Patient not found'), host);

    expect(responseBody).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/v1/patients/example-id' }),
    );
  });

  it('hides internal exception messages from 5xx responses', () => {
    const responseBody = jest.fn();
    const response = {
      status: jest.fn().mockReturnThis(),
      json: responseBody,
      getHeader: jest.fn().mockReturnValue('request-789'),
    };
    const request = {
      method: 'GET',
      originalUrl: '/api/v1/reports',
      path: '/api/v1/reports',
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response as unknown as Response,
        getRequest: () => request as unknown as Request,
      }),
    } as unknown as ArgumentsHost;

    new ApiExceptionFilter().catch(
      new HttpException(
        {
          code: 'PRIVATE_DATABASE_FAILURE',
          message: 'DATABASE_URL=postgres://private connection failed',
        },
        500,
      ),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(responseBody).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'HTTP_500',
        message: 'Internal server error',
        requestId: 'request-789',
      }),
    );
    expect(JSON.stringify(responseBody.mock.calls)).not.toContain('private connection');
    expect(JSON.stringify(responseBody.mock.calls)).not.toContain('DATABASE_URL');
    expect(JSON.stringify(responseBody.mock.calls)).not.toContain('PRIVATE_DATABASE_FAILURE');
  });

  it('redacts secret-shaped values from internal error logs', () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      getHeader: jest.fn().mockReturnValue('request-999'),
    };
    const request = {
      method: 'POST',
      originalUrl: '/api/v1/auth/login',
      path: '/api/v1/auth/login',
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response as unknown as Response,
        getRequest: () => request as unknown as Request,
      }),
    } as unknown as ArgumentsHost;
    const error = new Error(
      'provider failed password:plain-password token="bearer-token" apiKey=service-key Authorization: Bearer auth-token',
    );
    const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    new ApiExceptionFilter().catch(error, host);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal server error' }),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'provider failed password:[redacted] token=[redacted] apiKey=[redacted] Authorization: [redacted]',
      }),
    );
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain('plain-password');
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain('bearer-token');
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain('service-key');
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain('auth-token');
    logSpy.mockRestore();
  });
});
