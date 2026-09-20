import type { MembershipRole } from '@prisma/client';
import type { Permission } from '@veterinary-saas/contracts';

// The permission catalog is intentionally small and code-defined until a future custom-role phase.
export const PERMISSIONS = {
  ORGANIZATION: {
    READ: 'organization.read',
    UPDATE: 'organization.update',
  },
  LOCATIONS: {
    READ: 'locations.read',
    MANAGE: 'locations.manage',
  },
  MEMBERSHIPS: {
    READ: 'memberships.read',
    MANAGE: 'memberships.manage',
  },
} as const satisfies Record<string, Record<string, Permission>>;

// OWNER and ADMIN are equal for this foundation; OWNER remains reserved for future ownership actions.
export const ROLE_PERMISSIONS: Record<MembershipRole, readonly Permission[]> = {
  OWNER: [
    PERMISSIONS.ORGANIZATION.READ,
    PERMISSIONS.ORGANIZATION.UPDATE,
    PERMISSIONS.LOCATIONS.READ,
    PERMISSIONS.LOCATIONS.MANAGE,
    PERMISSIONS.MEMBERSHIPS.READ,
    PERMISSIONS.MEMBERSHIPS.MANAGE,
  ],
  ADMIN: [
    PERMISSIONS.ORGANIZATION.READ,
    PERMISSIONS.ORGANIZATION.UPDATE,
    PERMISSIONS.LOCATIONS.READ,
    PERMISSIONS.LOCATIONS.MANAGE,
    PERMISSIONS.MEMBERSHIPS.READ,
    PERMISSIONS.MEMBERSHIPS.MANAGE,
  ],
  VETERINARIAN: [PERMISSIONS.ORGANIZATION.READ, PERMISSIONS.LOCATIONS.READ],
  ASSISTANT: [PERMISSIONS.ORGANIZATION.READ, PERMISSIONS.LOCATIONS.READ],
  RECEPTION: [PERMISSIONS.ORGANIZATION.READ, PERMISSIONS.LOCATIONS.READ],
  GROOMER: [PERMISSIONS.ORGANIZATION.READ, PERMISSIONS.LOCATIONS.READ],
  CASHIER: [PERMISSIONS.ORGANIZATION.READ, PERMISSIONS.LOCATIONS.READ],
};

export function permissionsForRole(role: MembershipRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function hasPermissions(role: MembershipRole, required: readonly Permission[]): boolean {
  const granted = new Set(ROLE_PERMISSIONS[role]);
  return required.every((permission) => granted.has(permission));
}
