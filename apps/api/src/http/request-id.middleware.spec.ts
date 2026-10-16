import { describe, expect, it, jest } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';
import { REQUEST_ID_HEADER, RequestIdMiddleware } from './request-id.middleware';

describe('RequestIdMiddleware', () => {
  function run(incoming?: string) {
    const setHeader = jest.fn();
    const request = {
      header: jest.fn().mockReturnValue(incoming),
    } as unknown as Request;
    const response = { setHeader } as unknown as Response;
    const next = jest.fn() as NextFunction;
    new RequestIdMiddleware().use(request, response, next);
    return { setHeader, next };
  }

  it('propagates a safe upstream request id', () => {
    const { setHeader, next } = run('edge-123:abc');

    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'edge-123:abc');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('replaces malformed ids with a generated UUID', () => {
    const { setHeader, next } = run('not safe for logs');
    const generated = (setHeader as jest.Mock).mock.calls[0]?.[1];

    expect(generated).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
    expect(next).toHaveBeenCalledTimes(1);
  });
});
