import { Injectable, type NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, NextFunction } from 'express';
import type { Environment } from '../config/env';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// Nest's middleware path can include or omit the configured global prefix at this boundary.
const MULTIPART_PATHS = [
  /^\/(?:api\/v1\/)?patients\/[0-9a-f-]+\/documents\/?$/i,
  /^\/(?:api\/v1\/)?public\/signatures\/[^/]+\/sign\/?$/i,
];

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
    // Wildcard middleware sees a mount-relative path, so route matching uses the original request URL.
    const requestPath = request.originalUrl.split('?', 1)[0] ?? request.path;
    const isJson = Boolean(contentType && /^application\/json(?:\s*;|$)/i.test(contentType));
    const isAllowedMultipart = Boolean(
      contentType &&
      /^multipart\/form-data(?:\s*;|$)/i.test(contentType) &&
      MULTIPART_PATHS.some((path) => path.test(requestPath)),
    );
    if (contentType && !isJson && !isAllowedMultipart) {
      response.status(415).json({
        statusCode: 415,
        code: 'CONTENT_TYPE_REJECTED',
        message: 'Unsupported content type',
      });
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
