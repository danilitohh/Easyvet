import type { Request } from 'express';
import type { Permission } from '@veterinary-saas/contracts';

export type AuthenticatedUser = {
  id: string;
  email: string;
  platformRole: 'USER' | 'PLATFORM_ADMIN';
};

export type AuthenticatedMembership = {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'VETERINARIAN' | 'ASSISTANT' | 'RECEPTION' | 'GROOMER' | 'CASHIER';
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED';
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  permissions: Permission[];
};

// This context is request-local and intentionally omits passwordHash, tokenHash, and session internals.
export type AuthenticatedRequestContext = {
  sessionId: string;
  user: AuthenticatedUser;
  activeMembership: AuthenticatedMembership | null;
};

export type AuthenticatedRequest = Request & {
  auth?: AuthenticatedRequestContext;
};
