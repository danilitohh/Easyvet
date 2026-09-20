import type { Request } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.types';
import type { Permission } from '@veterinary-saas/contracts';

export type TenantContext = {
  organizationId: string;
  membershipId: string;
  role: 'OWNER' | 'ADMIN' | 'VETERINARIAN' | 'ASSISTANT' | 'RECEPTION' | 'GROOMER' | 'CASHIER';
  userId: string;
};

export type TenantRequest = AuthenticatedRequest & {
  tenant?: TenantContext;
};

export type PermissionRequest = Request & {
  auth?: AuthenticatedRequest['auth'];
  tenant?: TenantContext;
};

export type RequiredPermission = Permission;
