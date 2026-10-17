import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/env';
import { DatabaseSecurityContext } from '../infrastructure/database/database-security-context';
import { PrismaService } from '../infrastructure/database/prisma.service';

interface RateLimitBucketResult {
  request_count: number;
  blocked_until: Date | null;
}

@Injectable()
export class RateLimitService {
  private readonly hashingKey: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Environment, true>,
    private readonly databaseSecurity: DatabaseSecurityContext,
  ) {
    this.hashingKey = config.get('DATABASE_URL', { infer: true });
  }

  async check(
    name: string,
    identity: string,
  ): Promise<{ limited: boolean; retryAfterSeconds: number }> {
    return this.withSystemScope(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ blocked_until: Date | null }>>`
        SELECT blocked_until
        FROM api_rate_limit_buckets
        WHERE key_hash = ${this.keyHash(name, identity)}
      `;
      const blockedUntil = rows[0]?.blocked_until;
      const retryAfterSeconds = blockedUntil
        ? Math.max(0, Math.ceil((blockedUntil.getTime() - Date.now()) / 1000))
        : 0;
      return { limited: retryAfterSeconds > 0, retryAfterSeconds };
    });
  }

  async clear(name: string, identity: string): Promise<void> {
    await this.withSystemScope(
      (tx) => tx.$executeRaw`
        DELETE FROM api_rate_limit_buckets WHERE key_hash = ${this.keyHash(name, identity)}
      `,
    );
  }

  async consume(
    name: string,
    identity: string,
    limit: number,
    windowMs: number,
    blockMs = windowMs,
  ): Promise<{ limited: boolean; retryAfterSeconds: number }> {
    return this.withSystemScope(async (tx) => {
      const now = new Date();
      const windowExpiresAt = new Date(now.getTime() + windowMs);
      const blockedUntil = new Date(now.getTime() + blockMs);
      const keyHash = this.keyHash(name, identity);

      const rows = await tx.$queryRaw<RateLimitBucketResult[]>`
        WITH stale AS (
          SELECT ctid
          FROM api_rate_limit_buckets
          WHERE expires_at <= ${now}
            AND key_hash <> ${keyHash}
          ORDER BY expires_at
          LIMIT 10
        ), cleanup AS (
          DELETE FROM api_rate_limit_buckets
          WHERE ctid IN (SELECT ctid FROM stale)
          RETURNING key_hash
        )
        INSERT INTO api_rate_limit_buckets AS bucket
          (key_hash, request_count, window_started_at, blocked_until, expires_at)
        VALUES (${keyHash}, 1, ${now}, NULL, ${windowExpiresAt})
        ON CONFLICT (key_hash) DO UPDATE SET
          request_count = CASE
            WHEN bucket.expires_at <= ${now} THEN 1
            WHEN bucket.blocked_until > ${now} THEN bucket.request_count
            ELSE bucket.request_count + 1
          END,
          window_started_at = CASE
            WHEN bucket.expires_at <= ${now} THEN ${now}
            ELSE bucket.window_started_at
          END,
          blocked_until = CASE
            WHEN bucket.blocked_until > ${now} THEN bucket.blocked_until
            WHEN bucket.expires_at <= ${now} THEN NULL
            WHEN bucket.request_count + 1 > ${limit} THEN ${blockedUntil}
            ELSE NULL
          END,
          expires_at = CASE
            WHEN bucket.expires_at <= ${now} THEN ${windowExpiresAt}
            WHEN bucket.blocked_until > ${now} THEN bucket.expires_at
            WHEN bucket.request_count + 1 > ${limit}
              THEN GREATEST(bucket.expires_at, ${blockedUntil})
            ELSE bucket.expires_at
          END
        RETURNING request_count, blocked_until
      `;

      if (!rows[0]) throw new Error('Rate limit bucket could not be updated');
      const retryAfterSeconds = rows[0].blocked_until
        ? Math.max(1, Math.ceil((rows[0].blocked_until.getTime() - now.getTime()) / 1000))
        : 0;
      return { limited: retryAfterSeconds > 0, retryAfterSeconds };
    });
  }

  private withSystemScope<T>(operation: (tx: PrismaService) => Promise<T>): Promise<T> {
    return this.databaseSecurity.runSystem(() =>
      this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          SELECT
            set_config('app.easyvet_context', 'system', TRUE),
            set_config('app.easyvet_organization_id', '', TRUE)
        `;
        return operation(tx as PrismaService);
      }),
    );
  }

  private keyHash(name: string, identity: string): string {
    return createHmac('sha256', this.hashingKey).update(`${name}\0${identity}`).digest('hex');
  }
}
