import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PublicRateLimitGuard } from './public-rate-limit.guard';
import type { RateLimitRule } from './rate-limit.decorator';
import { RateLimitService } from './rate-limit.service';

describe('PublicRateLimitGuard', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercel = process.env.VERCEL;
  const rule: RateLimitRule = {
    name: 'auth.login.email',
    identity: 'email',
    limit: 8,
    windowMs: 60_000,
  };
  const reflector = { getAllAndOverride: jest.fn() };
  const consume =
    jest.fn<
      (
        name: string,
        identity: string,
        limit: number,
        windowMs: number,
        blockMs?: number,
      ) => Promise<{ limited: boolean; retryAfterSeconds: number }>
    >();
  const limits = { consume } as unknown as RateLimitService;
  const response = { setHeader: jest.fn() };
  const request: {
    body: { email: string };
    params: Record<string, string>;
    headers: Record<string, string>;
    ip: string;
  } = { body: { email: ' Client@Example.Test ' }, params: {}, headers: {}, ip: '127.0.0.1' };
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
  const guard = new PublicRateLimitGuard(reflector as never, limits);

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'production';
    delete process.env.VERCEL;
    request.headers = {};
    request.ip = '127.0.0.1';
    reflector.getAllAndOverride.mockReturnValue([rule]);
    consume.mockResolvedValue({ limited: false, retryAfterSeconds: 0 });
  });

  afterAll(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  });

  it('uses a normalized identity and allows requests while all buckets are under their limits', async () => {
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(consume).toHaveBeenCalledWith(
      'auth.login.email',
      'client@example.test',
      8,
      60_000,
      undefined,
    );
  });

  it('uses the first validated client IP from Vercel’s overwritten forwarding header', async () => {
    process.env.VERCEL = '1';
    request.headers['x-forwarded-for'] = '198.51.100.42, 10.0.0.1';
    reflector.getAllAndOverride.mockReturnValue([
      { ...rule, name: 'auth.login.ip', identity: 'ip' },
    ]);

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(consume).toHaveBeenCalledWith('auth.login.ip', '198.51.100.42', 8, 60_000, undefined);
  });

  it('ignores a forwarded header outside Vercel and uses the framework client IP', async () => {
    request.headers['x-forwarded-for'] = '203.0.113.200';
    request.ip = '192.0.2.15';
    reflector.getAllAndOverride.mockReturnValue([
      { ...rule, name: 'auth.login.ip', identity: 'ip' },
    ]);

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(consume).toHaveBeenCalledWith('auth.login.ip', '192.0.2.15', 8, 60_000, undefined);
  });

  it('sets Retry-After and returns a controlled 429 when a shared bucket is blocked', async () => {
    consume.mockResolvedValue({ limited: true, retryAfterSeconds: 45 });

    const error = await guard.canActivate(context).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '45');
  });
});
