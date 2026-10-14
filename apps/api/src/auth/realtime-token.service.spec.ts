import { describe, expect, it } from '@jest/globals';
import { createHmac } from 'node:crypto';
import { RealtimeTokenService } from './realtime-token.service';

const activeContext = {
  sessionId: 'session-id',
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'vet@example.com',
    platformRole: 'USER' as const,
    mustChangePassword: false,
  },
  activeMembership: {
    id: '22222222-2222-4222-8222-222222222222',
    role: 'VETERINARIAN' as const,
    clinicalRole: 'PRACTITIONER' as const,
    status: 'ACTIVE' as const,
    organization: {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Clínica de prueba',
      slug: 'clinica-prueba',
    },
    permissions: [],
  },
};

describe('RealtimeTokenService', () => {
  it('signs a short-lived Supabase token scoped to the active organization', () => {
    const secret = 'test-secret';
    const service = new RealtimeTokenService({ get: () => secret } as never);
    const { accessToken } = service.issue(activeContext);
    const [header, payload, signature] = accessToken.split('.');
    const claims = JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8')) as {
      aud: string;
      exp: number;
      iat: number;
      organization_id: string;
      role: string;
      sub: string;
    };
    const expectedSignature = createHmac('sha256', secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    expect(signature).toBe(expectedSignature);
    expect(claims).toMatchObject({
      aud: 'authenticated',
      organization_id: activeContext.activeMembership.organization.id,
      role: 'authenticated',
      sub: activeContext.user.id,
    });
    expect(claims.exp - claims.iat).toBe(300);
  });

  it('does not issue a token without an active clinic membership', () => {
    const service = new RealtimeTokenService({ get: () => 'test-secret' } as never);
    expect(() => service.issue({ ...activeContext, activeMembership: null })).toThrow(
      'Realtime requiere una clínica activa.',
    );
  });
});
