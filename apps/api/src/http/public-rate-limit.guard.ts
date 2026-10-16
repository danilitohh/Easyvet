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
import { RATE_LIMIT_POLICY_KEY, RateLimitRule } from './rate-limit.decorator';
import { RateLimitService } from './rate-limit.service';

type PublicRequest = Request<{ token?: string }, unknown, unknown>;

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
    if (!rules?.length) return true;

    const request = context.switchToHttp().getRequest<PublicRequest>();
    for (const rule of rules) {
      const identity = this.identityFor(rule.identity, request);
      if (process.env.NODE_ENV === 'test') continue;
      const result =
        rule.mode === 'check'
          ? await this.limits.check(rule.name, identity)
          : await this.limits.consume(
              rule.name,
              identity,
              rule.limit,
              rule.windowMs,
              rule.blockMs,
            );
      if (!result.limited) continue;

      const response = context.switchToHttp().getResponse<Response>();
      response.setHeader('Retry-After', String(result.retryAfterSeconds));
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private identityFor(identityType: RateLimitRule['identity'], request: PublicRequest): string {
    if (identityType === 'ip') return this.clientIp(request);
    if (identityType === 'email') {
      const body = request.body as { email?: unknown } | undefined;
      return typeof body?.email === 'string' ? body.email.trim().toLowerCase().slice(0, 320) : 'invalid';
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
