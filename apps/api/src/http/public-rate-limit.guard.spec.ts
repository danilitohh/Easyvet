import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PublicRateLimitGuard } from './public-rate-limit.guard';
import type { RateLimitRule } from './rate-limit.decorator';
import { RateLimitService } from './rate-limit.service';

describe('PublicRateLimitGuard', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const rule: RateLimitRule = {
    name: 'auth.login.email',
    identity: 'email',
    limit: 8,
    windowMs: 60_000,
  };
  const reflector = { getAllAndOverride: jest.fn() };
  const consume = jest.fn<
    (name: string, identity: string, limit: number, windowMs: number, blockMs?: number) =>
      Promise<{ limited: boolean; retryAfterSeconds: number }>
  >();
  const limits = { consume } as unknown as RateLimitService;
  const response = { setHeader: jest.fn() };
  const request = { body: { email: ' Client@Example.Test ' }, params: {}, headers: {}, ip: '127.0.0.1' };
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
  const guard = new PublicRateLimitGuard(reflector as never, limits);

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'production';
    reflector.getAllAndOverride.mockReturnValue([rule]);
    consume.mockResolvedValue({ limited: false, retryAfterSeconds: 0 });
  });

  afterAll(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
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

  it('sets Retry-After and returns a controlled 429 when a shared bucket is blocked', async () => {
    consume.mockResolvedValue({ limited: true, retryAfterSeconds: 45 });

    const error = await guard.canActivate(context).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '45');
  });
});
