import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';

export type AccountAction = 'verify-email' | 'password-reset';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Signed short-lived tokens avoid storing raw reset links; changing the password hash invalidates old links.
@Injectable()
export class AuthActionTokenService {
  create(userId: string, passwordHash: string, action: AccountAction, ttlMs: number): string {
    const expiresAt = Date.now() + ttlMs;
    const nonce = randomBytes(24).toString('base64url');
    const payload = `${userId}.${expiresAt}.${nonce}`;
    const signature = this.signature(passwordHash, action, payload).toString('base64url');
    return Buffer.from(`${payload}.${signature}`).toString('base64url');
  }

  verify(
    token: string,
    passwordHash: string,
    action: AccountAction,
  ): { userId: string; expiresAt: number } | null {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const [userId, expiresText, nonce, signatureText, ...unexpected] = decoded.split('.');
      const expiresAt = Number(expiresText);
      if (
        unexpected.length > 0 ||
        !userId ||
        !UUID_PATTERN.test(userId) ||
        !Number.isSafeInteger(expiresAt) ||
        expiresAt <= Date.now() ||
        !nonce ||
        !signatureText
      ) {
        return null;
      }

      const provided = Buffer.from(signatureText, 'base64url');
      const expected = this.signature(passwordHash, action, `${userId}.${expiresAt}.${nonce}`);
      if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
      return { userId, expiresAt };
    } catch {
      return null;
    }
  }

  readUserId(token: string): string | null {
    try {
      const userId = Buffer.from(token, 'base64url').toString('utf8').split('.', 1)[0];
      return userId && UUID_PATTERN.test(userId) ? userId : null;
    } catch {
      return null;
    }
  }

  private signature(passwordHash: string, action: AccountAction, payload: string): Buffer {
    return createHmac('sha256', passwordHash).update(`${action}.${payload}`).digest();
  }
}
