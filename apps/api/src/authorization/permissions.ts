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
  OWNERS: {
    READ: 'owners.read',
    CREATE: 'owners.create',
    UPDATE: 'owners.update',
    ARCHIVE: 'owners.archive',
  },
  PATIENTS: {
    READ: 'patients.read',
    CREATE: 'patients.create',
    UPDATE: 'patients.update',
    ARCHIVE: 'patients.archive',
  },
  APPOINTMENTS: {
    READ: 'appointments.read',
    CREATE: 'appointments.create',
    UPDATE: 'appointments.update',
    CANCEL: 'appointments.cancel',
    CHECK_IN: 'appointments.checkIn',
    START: 'appointments.start',
    COMPLETE: 'appointments.complete',
    MARK_NO_SHOW: 'appointments.markNoShow',
  },
  AVAILABILITY: {
    READ: 'availability.read',
    MANAGE: 'availability.manage',
  },
} as const satisfies Record<string, Record<string, Permission>>;

const OWNER_PATIENT_ADMIN_PERMISSIONS: readonly Permission[] = [
  'owners.read',
  'owners.create',
  'owners.update',
  'owners.archive',
  'patients.read',
  'patients.create',
  'patients.update',
  'patients.archive',
];

const APPOINTMENT_OWNER_ADMIN_PERMISSIONS: readonly Permission[] = [
  'appointments.read',
  'appointments.create',
  'appointments.update',
  'appointments.cancel',
  'appointments.checkIn',
  'appointments.start',
  'appointments.complete',
  'appointments.markNoShow',
  'availability.read',
  'availability.manage',
];

// OWNER and ADMIN are equal for this foundation; OWNER remains reserved for future ownership actions.
export const ROLE_PERMISSIONS: Record<MembershipRole, readonly Permission[]> = {
  OWNER: [
    PERMISSIONS.ORGANIZATION.READ,
    PERMISSIONS.ORGANIZATION.UPDATE,
    PERMISSIONS.LOCATIONS.READ,
    PERMISSIONS.LOCATIONS.MANAGE,
    PERMISSIONS.MEMBERSHIPS.READ,
    PERMISSIONS.MEMBERSHIPS.MANAGE,
    ...OWNER_PATIENT_ADMIN_PERMISSIONS,
    ...APPOINTMENT_OWNER_ADMIN_PERMISSIONS,
  ],
  ADMIN: [
    PERMISSIONS.ORGANIZATION.READ,
    PERMISSIONS.ORGANIZATION.UPDATE,
    PERMISSIONS.LOCATIONS.READ,
    PERMISSIONS.LOCATIONS.MANAGE,
    PERMISSIONS.MEMBERSHIPS.READ,
    PERMISSIONS.MEMBERSHIPS.MANAGE,
    ...OWNER_PATIENT_ADMIN_PERMISSIONS,
    ...APPOINTMENT_OWNER_ADMIN_PERMISSIONS,
  ],
  VETERINARIAN: [
    PERMISSIONS.ORGANIZATION.READ,
    PERMISSIONS.LOCATIONS.READ,
    PERMISSIONS.OWNERS.READ,
    PERMISSIONS.OWNERS.CREATE,
    PERMISSIONS.OWNERS.UPDATE,
    PERMISSIONS.PATIENTS.READ,
    PERMISSIONS.PATIENTS.CREATE,
    PERMISSIONS.PATIENTS.UPDATE,
    'appointments.read',
    'appointments.create',
    'appointments.update',
    'appointments.checkIn',
    'appointments.start',
    'appointments.complete',
    'appointments.markNoShow',
    'availability.read',
  ],
  ASSISTANT: [
    PERMISSIONS.ORGANIZATION.READ,
    PERMISSIONS.LOCATIONS.READ,
    PERMISSIONS.OWNERS.READ,
    PERMISSIONS.PATIENTS.READ,
    PERMISSIONS.PATIENTS.CREATE,
    PERMISSIONS.PATIENTS.UPDATE,
    'appointments.read',
    'appointments.create',
    'appointments.update',
    'appointments.checkIn',
    'availability.read',
  ],
  RECEPTION: [
    PERMISSIONS.ORGANIZATION.READ,
    PERMISSIONS.LOCATIONS.READ,
    PERMISSIONS.OWNERS.READ,
    PERMISSIONS.OWNERS.CREATE,
    PERMISSIONS.OWNERS.UPDATE,
    PERMISSIONS.PATIENTS.READ,
    PERMISSIONS.PATIENTS.CREATE,
    PERMISSIONS.PATIENTS.UPDATE,
    'appointments.read',
    'appointments.create',
    'appointments.update',
    'appointments.cancel',
    'appointments.checkIn',
    'appointments.markNoShow',
    'availability.read',
  ],
  GROOMER: [
    PERMISSIONS.ORGANIZATION.READ,
    PERMISSIONS.LOCATIONS.READ,
    PERMISSIONS.OWNERS.READ,
    PERMISSIONS.PATIENTS.READ,
    'appointments.read',
  ],
  CASHIER: [
    PERMISSIONS.ORGANIZATION.READ,
    PERMISSIONS.LOCATIONS.READ,
    PERMISSIONS.OWNERS.READ,
    PERMISSIONS.PATIENTS.READ,
    'appointments.read',
  ],
};

export function permissionsForRole(role: MembershipRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function hasPermissions(role: MembershipRole, required: readonly Permission[]): boolean {
  const granted = new Set(ROLE_PERMISSIONS[role]);
  return required.every((permission) => granted.has(permission));
}
