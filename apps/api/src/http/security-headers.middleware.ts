import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import type { Environment } from '../config/env';

// Keep API responses protected even when traffic reaches Nest without Vercel's edge headers.
@Injectable()
export class SecurityHeadersMiddleware {
  private readonly production: boolean;

  constructor(config: ConfigService<Environment, true>) {
    this.production = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  use(_request: Request, response: Response, next: NextFunction): void {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader(
      'Permissions-Policy',
      'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
    );
    if (this.production) {
      response.setHeader(
        'Strict-Transport-Security',
        'max-age=63072000; includeSubDomains; preload',
      );
    }
    next();
  }
}
