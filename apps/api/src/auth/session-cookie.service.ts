import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { Environment } from '../config/env';

// Centralizes the HttpOnly session cookie attributes and avoids token handling in controllers.
@Injectable()
export class SessionCookieService {
  private readonly cookieName: string;
  private readonly secure: boolean;
  private readonly ttlMs: number;

  constructor(config: ConfigService<Environment, true>) {
    this.cookieName = config.get('SESSION_COOKIE_NAME', { infer: true });
    this.secure = config.get('NODE_ENV', { infer: true }) === 'production';
    this.ttlMs = config.get('SESSION_TTL_HOURS', { infer: true }) * 60 * 60 * 1000;
  }

  read(request: Request): string | undefined {
    const value = request.cookies?.[this.cookieName];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  set(response: Response, token: string, expiresAt: Date): void {
    response.cookie(this.cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.secure,
      path: '/',
      maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
    });
  }

  clear(response: Response): void {
    response.clearCookie(this.cookieName, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.secure,
      path: '/',
    });
  }

  get ttlMilliseconds(): number {
    return this.ttlMs;
  }
}
