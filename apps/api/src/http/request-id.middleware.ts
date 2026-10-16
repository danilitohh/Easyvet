import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const REQUEST_ID_HEADER = 'X-Request-Id';
const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function validRequestId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_REQUEST_ID.test(value);
}

// Reuse a safe upstream correlation id when present; otherwise create one for this request.
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const incoming = request.header('x-request-id');
    const requestId = validRequestId(incoming) ? incoming : randomUUID();
    response.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  }
}

export { REQUEST_ID_HEADER, validRequestId };
