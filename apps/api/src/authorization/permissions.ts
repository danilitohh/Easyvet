import type { ClinicalRole, MembershipRole } from '@prisma/client';
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
  CLINICAL: {
    RECORDS_READ: 'clinicalRecords.read',
    ENCOUNTERS_READ: 'clinicalEncounters.read',
    ENCOUNTERS_CREATE: 'clinicalEncounters.create',
    ENCOUNTERS_UPDATE_DRAFT: 'clinicalEncounters.updateDraft',
    ENCOUNTERS_FINALIZE: 'clinicalEncounters.finalize',
    ENCOUNTERS_VOID: 'clinicalEncounters.void',
    EVOLUTIONS_READ: 'clinicalEvolutions.read',
    EVOLUTIONS_CREATE: 'clinicalEvolutions.create',
    VITALS_READ: 'clinicalVitals.read',
    VITALS_CREATE: 'clinicalVitals.create',
    PRESCRIPTIONS_READ: 'prescriptions.read',
    PRESCRIPTIONS_CREATE: 'prescriptions.create',
    PRESCRIPTIONS_UPDATE_DRAFT: 'prescriptions.updateDraft',
    PRESCRIPTIONS_FINALIZE: 'prescriptions.finalize',
    PRESCRIPTIONS_VOID: 'prescriptions.void',
    VACCINATIONS_READ: 'vaccinations.read',
    VACCINATIONS_CREATE: 'vaccinations.create',
    VACCINATIONS_UPDATE_DRAFT: 'vaccinations.updateDraft',
    VACCINATIONS_FINALIZE: 'vaccinations.finalize',
    VACCINATIONS_VOID: 'vaccinations.void',
    DEWORMINGS_READ: 'dewormings.read',
    DEWORMINGS_CREATE: 'dewormings.create',
    DEWORMINGS_UPDATE_DRAFT: 'dewormings.updateDraft',
    DEWORMINGS_FINALIZE: 'dewormings.finalize',
    DEWORMINGS_VOID: 'dewormings.void',
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

// Clinical permissions are derived only from the orthogonal ClinicalRole field.
export const CLINICAL_ROLE_PERMISSIONS: Record<ClinicalRole, readonly Permission[]> = {
  PRACTITIONER: [
    'clinicalRecords.read',
    'clinicalEncounters.read',
    'clinicalEncounters.create',
    'clinicalEncounters.updateDraft',
    'clinicalEncounters.finalize',
    'clinicalEncounters.void',
    'clinicalEvolutions.read',
    'clinicalEvolutions.create',
    'clinicalVitals.read',
    'clinicalVitals.create',
    'prescriptions.read',
    'prescriptions.create',
    'prescriptions.updateDraft',
    'prescriptions.finalize',
    'prescriptions.void',
    'vaccinations.read',
    'vaccinations.create',
    'vaccinations.updateDraft',
    'vaccinations.finalize',
    'vaccinations.void',
    'dewormings.read',
    'dewormings.create',
    'dewormings.updateDraft',
    'dewormings.finalize',
    'dewormings.void',
  ],
  CLINICAL_ASSISTANT: [
    'clinicalRecords.read',
    'clinicalEncounters.read',
    'clinicalEncounters.create',
    'clinicalEncounters.updateDraft',
    'clinicalEvolutions.read',
    'clinicalVitals.read',
    'clinicalVitals.create',
    'prescriptions.read',
    'prescriptions.create',
    'prescriptions.updateDraft',
    'vaccinations.read',
    'vaccinations.create',
    'vaccinations.updateDraft',
    'dewormings.read',
    'dewormings.create',
    'dewormings.updateDraft',
  ],
};

export function permissionsForRole(
  role: MembershipRole,
  clinicalRole: ClinicalRole | null = null,
): Permission[] {
  const permissions = [...ROLE_PERMISSIONS[role]];
  if (clinicalRole) {
    permissions.push(...CLINICAL_ROLE_PERMISSIONS[clinicalRole]);
  }
  return [...new Set(permissions)];
}

export function hasPermissions(
  role: MembershipRole,
  clinicalRole: ClinicalRole | null,
  required: readonly Permission[],
): boolean {
  const granted = new Set(permissionsForRole(role, clinicalRole));
  return required.every((permission) => granted.has(permission));
}
