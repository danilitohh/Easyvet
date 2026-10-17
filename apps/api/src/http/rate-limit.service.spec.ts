import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Environment } from '../config/env';
import { DatabaseSecurityContext } from '../infrastructure/database/database-security-context';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { RateLimitService } from './rate-limit.service';

describe('RateLimitService', () => {
  const queryRaw = jest.fn<(...args: unknown[]) => Promise<unknown[]>>();
  const executeRaw = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const transaction = jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({ $queryRaw: queryRaw, $executeRaw: executeRaw }),
  );
  const prisma = { $queryRaw: queryRaw, $transaction: transaction } as unknown as PrismaService;
  const config = {
    get: jest.fn().mockReturnValue('postgresql://runtime-secret@localhost/easyvet'),
  } as unknown as ConfigService<Environment, true>;
  const service = new RateLimitService(prisma, config, new DatabaseSecurityContext());

  beforeEach(() => {
    jest.clearAllMocks();
    queryRaw.mockResolvedValue([{ request_count: 1, blocked_until: null }]);
    executeRaw.mockResolvedValue(1);
  });

  it('stores only a keyed digest of request identities in the shared database bucket', async () => {
    await expect(service.consume('auth.login.email', 'client@example.test', 8, 60_000)).resolves.toEqual({
      limited: false,
      retryAfterSeconds: 0,
    });

    const serializedQuery = JSON.stringify(queryRaw.mock.calls[0]);
    expect(serializedQuery).not.toContain('client@example.test');
    expect(serializedQuery).toMatch(/[a-f0-9]{64}/);
  });

  it('reports a retry interval when the shared bucket has placed a temporary block', async () => {
    queryRaw.mockResolvedValue([
      { request_count: 9, blocked_until: new Date(Date.now() + 60_000) },
    ]);

    const result = await service.consume('auth.login.email', 'client@example.test', 8, 60_000);

    expect(result.limited).toBe(true);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('checks an existing failure bucket without consuming another attempt', async () => {
    queryRaw.mockResolvedValue([{ blocked_until: new Date(Date.now() + 30_000) }]);

    const result = await service.check('auth.login.failure.email', 'client@example.test');

    expect(result.limited).toBe(true);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });
});
