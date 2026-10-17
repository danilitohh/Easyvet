import { isIP } from 'node:net';
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RATE_LIMIT_POLICY_KEY, RateLimitRule } from './rate-limit.decorator';
import { RateLimitService } from './rate-limit.service';

type PublicRequest = Request<{ token?: string }, unknown, unknown> &
  Partial<Pick<AuthenticatedRequest, 'auth'>>;

const DEFAULT_AUTHENTICATED_LIMIT = 600;
const DEFAULT_AUTHENTICATED_WINDOW_MS = 15 * 60_000;

@Injectable()
export class PublicRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limits: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rules = this.reflector.getAllAndOverride<RateLimitRule[]>(RATE_LIMIT_POLICY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<PublicRequest>();
    if (!rules?.length) {
      const userId = request.auth?.user.id;
      if (!userId || process.env.NODE_ENV === 'test') return true;
      const result = await this.limits.consume(
        'api.authenticated.user',
        userId,
        DEFAULT_AUTHENTICATED_LIMIT,
        DEFAULT_AUTHENTICATED_WINDOW_MS,
      );
      if (!result.limited) return true;
      this.setRetryAfter(context, result.retryAfterSeconds);
      throw this.rateLimited();
    }

    for (const rule of rules) {
      const identity = this.identityFor(rule.identity, request);
      if (process.env.NODE_ENV === 'test') continue;
      const result =
        rule.mode === 'check'
          ? await this.limits.check(rule.name, identity)
          : await this.limits.consume(rule.name, identity, rule.limit, rule.windowMs, rule.blockMs);
      if (!result.limited) continue;

      this.setRetryAfter(context, result.retryAfterSeconds);
      throw this.rateLimited();
    }
    return true;
  }

  private setRetryAfter(context: ExecutionContext, retryAfterSeconds: number): void {
    const response = context.switchToHttp().getResponse<Response>();
    response.setHeader('Retry-After', String(retryAfterSeconds));
  }

  private rateLimited(): HttpException {
    return new HttpException(
      {
        code: 'RATE_LIMITED',
        message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private identityFor(identityType: RateLimitRule['identity'], request: PublicRequest): string {
    if (identityType === 'ip') return this.clientIp(request);
    if (identityType === 'email') {
      const body = request.body as { email?: unknown } | undefined;
      return typeof body?.email === 'string'
        ? body.email.trim().toLowerCase().slice(0, 320)
        : 'invalid';
    }
    if (identityType === 'user') {
      const userId = request.auth?.user.id;
      if (typeof userId !== 'string' || userId.length === 0) {
        throw new HttpException(
          { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' },
          HttpStatus.UNAUTHORIZED,
        );
      }
      return userId;
    }
    const body = request.body as { token?: unknown } | undefined;
    const token = typeof body?.token === 'string' ? body.token : request.params.token;
    return typeof token === 'string' ? token.slice(0, 4096) : 'invalid';
  }

  private clientIp(request: PublicRequest): string {
    // Vercel overwrites this header at ingress; never trust it in a local/non-Vercel runtime.
    if (process.env.VERCEL === '1') {
      const forwarded = request.headers['x-forwarded-for'];
      const candidate = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
        ?.split(',', 1)[0]
        ?.trim();
      if (candidate && isIP(candidate)) return candidate;
    }
    return request.ip && isIP(request.ip) ? request.ip : 'unknown';
  }
}
