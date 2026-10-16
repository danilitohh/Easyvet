import { describe, expect, it } from '@jest/globals';
import { IS_PUBLIC_KEY } from '../authorization/public.decorator';
import { AuthController } from '../auth/auth.controller';
import { HealthController } from '../health/health.controller';
import { PublicSignaturesController } from '../consents/public-signatures.controller';
import { RATE_LIMIT_POLICY_KEY } from './rate-limit.decorator';

describe('public route rate-limit policies', () => {
  it('assigns an explicit policy to every public route except liveness', () => {
    const controllers = [AuthController, PublicSignaturesController, HealthController];
    const missingPolicies: string[] = [];

    for (const controller of controllers) {
      for (const methodName of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = (controller.prototype as unknown as Record<string, unknown>)[methodName];
        if (typeof handler !== 'function' || !Reflect.getMetadata(IS_PUBLIC_KEY, handler)) continue;
        if (controller === HealthController && methodName === 'getHealth') continue;

        const rules = Reflect.getMetadata(RATE_LIMIT_POLICY_KEY, handler);
        if (!Array.isArray(rules) || rules.length === 0) {
          missingPolicies.push(`${controller.name}.${methodName}`);
        }
      }
    }

    expect(missingPolicies).toEqual([]);
  });
});
