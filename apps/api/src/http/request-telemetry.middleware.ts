import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import type { Environment } from '../config/env';
import { REQUEST_ID_HEADER, validRequestId } from './request-id.middleware';

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
const LONG_IDENTIFIER_SEGMENT = /^[A-Za-z0-9_-]{16,}$/;

function normalizePathSegment(segment: string): string {
  if (
    UUID_SEGMENT.test(segment) ||
    /^\d+$/.test(segment) ||
    LONG_IDENTIFIER_SEGMENT.test(segment)
  ) {
    return ':param';
  }
  return segment.length > 64 ? ':param' : segment;
}

function safeRequestId(request: Request, response: Response): string {
  const responseId =
    typeof response.getHeader === 'function' ? response.getHeader(REQUEST_ID_HEADER) : undefined;
  if (validRequestId(responseId)) return responseId;

  const incoming = request.header('x-request-id');
  return validRequestId(incoming) ? incoming : 'missing';
}

/**
 * Keeps slow-request diagnostics useful without putting request data in logs.
 * Query strings, bodies, cookies, headers, tenant ids and clinical values are excluded.
 */
export function safeRequestPath(request: Request): string {
  const routePath = request.route?.path;
  if (typeof routePath === 'string') return routePath;

  const path = (request.path || '/').split(/[?#]/, 1)[0] || '/';
  return path.split('/').map(normalizePathSegment).join('/') || '/';
}

@Injectable()
export class RequestTelemetryMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestTelemetryMiddleware.name);

  constructor(private readonly config: ConfigService<Environment, true>) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();

    response.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const thresholdMs = this.config.get('SLOW_REQUEST_LOG_MS', { infer: true });
      if (durationMs < thresholdMs) return;

      this.logger.warn({
        event: 'slow_request',
        requestId: safeRequestId(request, response),
        method: request.method,
        path: safeRequestPath(request),
        statusCode: response.statusCode,
        durationMs: Math.round(durationMs),
        thresholdMs,
      });
    });

    next();
  }
}
