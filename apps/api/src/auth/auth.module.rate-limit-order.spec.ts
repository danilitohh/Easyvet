import { describe, expect, it } from '@jest/globals';
import { APP_GUARD } from '@nestjs/core';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { AuthModule } from './auth.module';
import { SessionAuthGuard } from './session-auth.guard';
import { PublicRateLimitGuard } from '../http/public-rate-limit.guard';

describe('AuthModule global guard order', () => {
  it('authenticates protected requests before applying per-user rate limits', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AuthModule) as Array<
      { provide?: unknown; useClass?: unknown } | unknown
    >;
    const globalGuards = providers
      .filter(
        (provider): provider is { provide: unknown; useClass: unknown } =>
          typeof provider === 'object' &&
          provider !== null &&
          'provide' in provider &&
          provider.provide === APP_GUARD,
      )
      .map(({ useClass }) => useClass);

    expect(globalGuards).toEqual([SessionAuthGuard, PublicRateLimitGuard]);
  });
});
