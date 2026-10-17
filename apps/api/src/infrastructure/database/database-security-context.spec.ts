import { describe, expect, it } from '@jest/globals';
import { DatabaseSecurityContext } from './database-security-context';

describe('DatabaseSecurityContext', () => {
  it('starts a scope denied when no request context exists', () => {
    const context = new DatabaseSecurityContext();

    expect(context.current()).toEqual({ mode: 'deny', organizationId: null });
  });

  it('allows a request to move from system authentication to one tenant', () => {
    const context = new DatabaseSecurityContext();
    const organizationId = '11111111-1111-4111-8111-111111111111';

    context.runDenied(() => {
      context.enterSystem();
      expect(context.current()).toEqual({ mode: 'system', organizationId: null });

      context.setTenant(organizationId);
      expect(context.current()).toEqual({ mode: 'tenant', organizationId });
    });

    expect(context.current()).toEqual({ mode: 'deny', organizationId: null });
  });

  it('rejects non-UUID tenant identities', () => {
    const context = new DatabaseSecurityContext();

    expect(() => context.runDenied(() => context.setTenant('organization-from-request'))).toThrow(
      'A valid organization id is required',
    );
  });

  it('does not leak concurrent request scopes', async () => {
    const context = new DatabaseSecurityContext();
    const north = '11111111-1111-4111-8111-111111111111';
    const south = '22222222-2222-4222-8222-222222222222';

    const scopes = await Promise.all([
      context.runDenied(async () => {
        context.setTenant(north);
        await new Promise((resolve) => setImmediate(resolve));
        return context.current();
      }),
      context.runDenied(async () => {
        context.setTenant(south);
        await new Promise((resolve) => setImmediate(resolve));
        return context.current();
      }),
    ]);

    expect(scopes).toEqual([
      { mode: 'tenant', organizationId: north },
      { mode: 'tenant', organizationId: south },
    ]);
  });
});
