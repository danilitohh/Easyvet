import { ArgumentsHost, HttpException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import type { Request, Response } from 'express';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  it('redacts public signature tokens and query values from error paths', () => {
    const responseBody = jest.fn();
    const response = { status: jest.fn().mockReturnThis(), json: responseBody };
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
      }),
    );
    expect(JSON.stringify(responseBody.mock.calls)).not.toContain('sample-token');
    expect(JSON.stringify(responseBody.mock.calls)).not.toContain('sample-code');
  });

  it('preserves ordinary route paths', () => {
    const responseBody = jest.fn();
    const response = { status: jest.fn().mockReturnThis(), json: responseBody };
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
    const response = { status: jest.fn().mockReturnThis(), json: responseBody };
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
      }),
    );
    expect(JSON.stringify(responseBody.mock.calls)).not.toContain('private connection');
    expect(JSON.stringify(responseBody.mock.calls)).not.toContain('DATABASE_URL');
    expect(JSON.stringify(responseBody.mock.calls)).not.toContain('PRIVATE_DATABASE_FAILURE');
  });
});
