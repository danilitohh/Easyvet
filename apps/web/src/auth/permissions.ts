import type { Permission } from '@veterinary-saas/contracts';

// Frontend constants mirror the server catalog only to improve navigation affordances.
export const PERMISSION = {
  ORGANIZATION_READ: 'organization.read',
  ORGANIZATION_UPDATE: 'organization.update',
  LOCATIONS_READ: 'locations.read',
  LOCATIONS_MANAGE: 'locations.manage',
  MEMBERSHIPS_READ: 'memberships.read',
  MEMBERSHIPS_MANAGE: 'memberships.manage',
  OWNERS_READ: 'owners.read',
  OWNERS_CREATE: 'owners.create',
  OWNERS_UPDATE: 'owners.update',
  OWNERS_ARCHIVE: 'owners.archive',
  PATIENTS_READ: 'patients.read',
  PATIENTS_CREATE: 'patients.create',
  PATIENTS_UPDATE: 'patients.update',
  PATIENTS_ARCHIVE: 'patients.archive',
} as const satisfies Record<string, Permission>;
