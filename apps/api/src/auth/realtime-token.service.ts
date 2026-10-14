import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import type { AuthenticatedRequestContext } from './auth.types';

const REALTIME_TOKEN_TTL_SECONDS = 5 * 60;

// Issues short-lived Supabase-compatible JWTs only after the opaque app session was authenticated.
@Injectable()
export class RealtimeTokenService {
  constructor(private readonly config: ConfigService) {}

  issue(context: AuthenticatedRequestContext) {
    const membership = context.activeMembership;
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ServiceUnavailableException('Realtime requiere una clínica activa.');
    }

    const secret = this.config.get<string>('SUPABASE_JWT_SECRET');
    if (!secret) {
      throw new ServiceUnavailableException('Realtime no está configurado en el servidor.');
    }

    const issuedAt = Math.floor(Date.now() / 1000);
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const payload = encode({
      aud: 'authenticated',
      exp: issuedAt + REALTIME_TOKEN_TTL_SECONDS,
      iat: issuedAt,
      iss: 'easyvet',
      membership_id: membership.id,
      organization_id: membership.organization.id,
      role: 'authenticated',
      sub: context.user.id,
    });
    const unsigned = `${header}.${payload}`;
    const signature = createHmac('sha256', secret).update(unsigned).digest('base64url');

    return { accessToken: `${unsigned}.${signature}` };
  }
}

function encode(value: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
