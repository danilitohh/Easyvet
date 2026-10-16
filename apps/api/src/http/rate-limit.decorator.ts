import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_POLICY_KEY = 'easyvet:rateLimitPolicy';

export type RateLimitIdentity = 'ip' | 'email' | 'token' | 'user';

export interface RateLimitRule {
  name: string;
  identity: RateLimitIdentity;
  limit: number;
  windowMs: number;
  blockMs?: number;
  mode?: 'consume' | 'check';
}

export const RateLimit = (...rules: RateLimitRule[]) => SetMetadata(RATE_LIMIT_POLICY_KEY, rules);
