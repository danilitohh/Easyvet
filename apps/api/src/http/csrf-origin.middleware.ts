import { Injectable, type NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, NextFunction } from 'express';
import type { Environment } from '../config/env';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Enforces a small origin and JSON boundary for cookie-authenticated browser mutations.
@Injectable()
export class CsrfOriginMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  use(request: Request, response: Response, next: NextFunction): void {
    if (!MUTATING_METHODS.has(request.method)) {
      next();
      return;
    }

    const contentType = request.headers['content-type'];
    if (contentType && !/^application\/json(?:\s*;|$)/i.test(contentType)) {
      response
        .status(415)
        .json({ statusCode: 415, code: 'JSON_REQUIRED', message: 'JSON required' });
      return;
    }

    const origin = request.headers.origin;
    const allowedOrigin = this.config.get('APP_ORIGIN', { infer: true });
    if (origin && origin !== allowedOrigin) {
      response
        .status(403)
        .json({ statusCode: 403, code: 'CSRF_ORIGIN_REJECTED', message: 'Origin rejected' });
      return;
    }

    next();
  }
}
