import { z } from 'zod';

// HealthResponse is the first shared contract proving both apps can consume one package.
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

const platformRoleSchema = z.enum(['USER', 'PLATFORM_ADMIN']);
const membershipRoleSchema = z.enum([
  'OWNER',
  'ADMIN',
  'VETERINARIAN',
  'ASSISTANT',
  'RECEPTION',
  'GROOMER',
  'CASHIER',
]);
const membershipStatusSchema = z.enum(['INVITED', 'ACTIVE', 'SUSPENDED']);
export const clinicalRoleSchema = z.enum(['PRACTITIONER', 'CLINICAL_ASSISTANT']);
export const permissionSchema = z.enum([
  'organization.read',
  'organization.update',
  'locations.read',
  'locations.manage',
  'memberships.read',
  'memberships.manage',
  'owners.read',
  'owners.create',
  'owners.update',
  'owners.archive',
  'patients.read',
  'patients.create',
  'patients.update',
  'patients.archive',
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
]);

const authenticatedUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  platformRole: platformRoleSchema,
});

const activeMembershipSchema = z.object({
  id: z.string().uuid(),
  role: membershipRoleSchema,
  clinicalRole: clinicalRoleSchema.nullable(),
  status: membershipStatusSchema,
  organization: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
  }),
  permissions: z.array(permissionSchema),
});

export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;
export type ActiveMembership = z.infer<typeof activeMembershipSchema>;
export type Permission = z.infer<typeof permissionSchema>;

export const loginRequestSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const loginResponseSchema = z.object({
  user: authenticatedUserSchema,
  activeMembership: activeMembershipSchema.nullable(),
  memberships: z.array(activeMembershipSchema),
  organizationSelectionRequired: z.boolean(),
});

export const authMeResponseSchema = loginResponseSchema;

export const switchOrganizationRequestSchema = z.object({
  membershipId: z.string().uuid(),
});

export const logoutResponseSchema = z.object({
  success: z.literal(true),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type AuthMeResponse = z.infer<typeof authMeResponseSchema>;
export type SwitchOrganizationRequest = z.infer<typeof switchOrganizationRequestSchema>;
export type LogoutResponse = z.infer<typeof logoutResponseSchema>;

export const organizationCurrentResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']),
  timezone: z.string(),
  locale: z.string(),
  currencyCode: z.string(),
});

export const updateOrganizationRequestSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  locale: z.string().trim().min(2).max(20).optional(),
  currencyCode: z.string().trim().min(3).max(3).optional(),
});

export const locationResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']),
  address: z.string().nullable(),
  city: z.string().nullable(),
});

export const membershipResponseSchema = z.object({
  id: z.string().uuid(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    status: z.enum(['ACTIVE', 'SUSPENDED']),
  }),
  role: membershipRoleSchema,
  clinicalRole: clinicalRoleSchema.nullable(),
  status: membershipStatusSchema,
});

export type OrganizationCurrentResponse = z.infer<typeof organizationCurrentResponseSchema>;
export type UpdateOrganizationRequest = z.infer<typeof updateOrganizationRequestSchema>;
export type LocationResponse = z.infer<typeof locationResponseSchema>;
export type MembershipResponse = z.infer<typeof membershipResponseSchema>;

const ownerStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);
const patientStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);
const patientSexSchema = z.enum(['MALE', 'FEMALE', 'UNKNOWN']);
// API pagination is bounded so a client cannot request arbitrarily expensive offsets.
const pageSchema = z.number().int().min(1).max(10_000);
const pageSizeSchema = z.number().int().min(1).max(100);

const ownerFieldsSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  documentType: z.string().nullable(),
  documentNumber: z.string().nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  secondaryPhone: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  notes: z.string().nullable(),
  status: ownerStatusSchema,
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const patientSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  species: z.string(),
  status: patientStatusSchema,
});

export const ownerResponseSchema = ownerFieldsSchema.extend({
  patients: z.array(patientSummarySchema).optional(),
});

const ownerSummarySchema = ownerFieldsSchema.pick({
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  status: true,
});

export const patientResponseSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  name: z.string(),
  species: z.string(),
  breed: z.string().nullable(),
  sex: patientSexSchema,
  birthDate: z.string().date().nullable(),
  birthDateEstimated: z.boolean(),
  color: z.string().nullable(),
  microchipNumber: z.string().nullable(),
  currentWeightKg: z.number().positive().nullable(),
  sterilized: z.boolean(),
  notes: z.string().nullable(),
  status: patientStatusSchema,
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  owner: ownerSummarySchema,
});

const paginationSchema = z.object({
  page: pageSchema,
  pageSize: pageSizeSchema,
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const ownersListResponseSchema = z.object({
  data: z.array(ownerResponseSchema),
  pagination: paginationSchema,
});

export const patientsListResponseSchema = z.object({
  data: z.array(patientResponseSchema),
  pagination: paginationSchema,
});

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

// Birth dates are civil dates: future values are invalid without applying a timezone conversion.
const birthDateSchema = z
  .string()
  .date()
  .refine((value) => value <= new Date().toISOString().slice(0, 10), {
    message: 'birthDate cannot be in the future',
  });

export const createOwnerRequestSchema = z
  .object({
    firstName: z.string().trim().min(1).max(120),
    lastName: optionalText(120),
    documentType: optionalText(40),
    documentNumber: optionalText(80),
    email: z.string().trim().email().max(320).nullable().optional(),
    phone: optionalText(40),
    secondaryPhone: optionalText(40),
    address: optionalText(240),
    city: optionalText(120),
    notes: optionalText(2000),
  })
  .strict();

export const updateOwnerRequestSchema = createOwnerRequestSchema.partial().strict();

export const createPatientRequestSchema = z
  .object({
    ownerId: z.string().uuid(),
    name: z.string().trim().min(1).max(160),
    species: z.string().trim().min(1).max(80),
    breed: optionalText(120),
    sex: patientSexSchema.optional(),
    birthDate: birthDateSchema.nullable().optional(),
    birthDateEstimated: z.boolean().optional(),
    color: optionalText(80),
    microchipNumber: optionalText(80),
    currentWeightKg: z.number().positive().nullable().optional(),
    sterilized: z.boolean().optional(),
    notes: optionalText(2000),
  })
  .strict();

export const updatePatientRequestSchema = createPatientRequestSchema
  .omit({ ownerId: true })
  .partial()
  .strict();

export type OwnerResponse = z.infer<typeof ownerResponseSchema>;
export type PatientResponse = z.infer<typeof patientResponseSchema>;
export type OwnersListResponse = z.infer<typeof ownersListResponseSchema>;
export type PatientsListResponse = z.infer<typeof patientsListResponseSchema>;
export type CreateOwnerRequest = z.infer<typeof createOwnerRequestSchema>;
export type UpdateOwnerRequest = z.infer<typeof updateOwnerRequestSchema>;
export type CreatePatientRequest = z.infer<typeof createPatientRequestSchema>;
export type UpdatePatientRequest = z.infer<typeof updatePatientRequestSchema>;

// Clinical Core responses are segmented so clients never receive an entire longitudinal history.
const clinicalEncounterStatusSchema = z.enum(['DRAFT', 'FINALIZED', 'VOIDED']);
export const clinicalAuditEntityTypeSchema = z.enum([
  'CLINICAL_RECORD',
  'CLINICAL_ENCOUNTER',
  'CLINICAL_EVOLUTION',
  'VITAL_MEASUREMENT',
]);
export const clinicalAuditActionSchema = z.enum([
  'CREATED',
  'UPDATED',
  'FINALIZED',
  'VOIDED',
  'EVOLUTION_ADDED',
  'VITAL_ADDED',
]);

const clinicalLocationSummarySchema = locationResponseSchema;
const clinicalProfessionalSummarySchema = z.object({
  membershipId: z.string().uuid(),
  displayName: z.string().nullable(),
  licenseNumber: z.string().nullable(),
  role: membershipRoleSchema,
  clinicalRole: clinicalRoleSchema.nullable(),
});
const clinicalPatientSummarySchema = patientSummarySchema.extend({ ownerId: z.string().uuid() });
const clinicalOwnerSummarySchema = ownerSummarySchema;
const clinicalAppointmentSummarySchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['SCHEDULED', 'WAITING_ROOM', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  reason: z.string(),
});

export const clinicalRecordResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  patientId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  encounterCount: z.number().int().nonnegative().optional(),
});

const clinicalEncounterFieldsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  clinicalRecordId: z.string().uuid(),
  patientId: z.string().uuid(),
  ownerIdAtTime: z.string().uuid(),
  clinicLocationId: z.string().uuid(),
  appointmentId: z.string().uuid().nullable(),
  responsibleMembershipId: z.string().uuid().nullable(),
  status: clinicalEncounterStatusSchema,
  version: z.number().int().positive(),
  reason: z.string(),
  anamnesis: z.string().nullable(),
  physicalExam: z.string().nullable(),
  presumptiveDiagnosis: z.string().nullable(),
  differentialDiagnosis: z.string().nullable(),
  definitiveDiagnosis: z.string().nullable(),
  diagnosticPlan: z.string().nullable(),
  therapeuticPlan: z.string().nullable(),
  recommendations: z.string().nullable(),
  followUpPlan: z.string().nullable(),
  notes: z.string().nullable(),
  professionalDisplayNameSnapshot: z.string().nullable(),
  professionalLicenseSnapshot: z.string().nullable(),
  finalizedAt: z.string().datetime({ offset: true }).nullable(),
  finalizedByMembershipId: z.string().uuid().nullable(),
  voidedAt: z.string().datetime({ offset: true }).nullable(),
  voidedByMembershipId: z.string().uuid().nullable(),
  voidReason: z.string().nullable(),
  occurredAt: z.string().datetime({ offset: true }),
  createdByMembershipId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const clinicalEncounterResponseSchema = clinicalEncounterFieldsSchema.extend({
  patient: clinicalPatientSummarySchema,
  historicalOwner: clinicalOwnerSummarySchema,
  clinicLocation: clinicalLocationSummarySchema,
  responsibleProfessional: clinicalProfessionalSummarySchema.nullable(),
  appointment: clinicalAppointmentSummarySchema.nullable(),
});

export const clinicalEncounterListResponseSchema = z.object({
  data: z.array(clinicalEncounterResponseSchema),
  pagination: paginationSchema,
});

export const clinicalVitalResponseSchema = z.object({
  id: z.string().uuid(),
  clinicalRecordId: z.string().uuid(),
  clinicalEncounterId: z.string().uuid(),
  patientId: z.string().uuid(),
  measuredAt: z.string().datetime({ offset: true }),
  weightKg: z.number().positive().nullable(),
  temperatureC: z.number().positive().nullable(),
  heartRateBpm: z.number().int().positive().nullable(),
  respiratoryRateBpm: z.number().int().positive().nullable(),
  bodyCondition: z.string().nullable(),
  hydration: z.string().nullable(),
  mucousMembranes: z.string().nullable(),
  skinTurgor: z.string().nullable(),
  observations: z.string().nullable(),
  recordedByMembershipId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
});

export const clinicalEvolutionResponseSchema = z.object({
  id: z.string().uuid(),
  clinicalRecordId: z.string().uuid(),
  clinicalEncounterId: z.string().uuid().nullable(),
  occurredAt: z.string().datetime({ offset: true }),
  subjective: z.string().nullable(),
  objective: z.string().nullable(),
  assessment: z.string().nullable(),
  plan: z.string().nullable(),
  authorMembershipId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
});

export const clinicalEvolutionListResponseSchema = z.object({
  data: z.array(clinicalEvolutionResponseSchema),
  pagination: paginationSchema,
});

export const clinicalVitalListResponseSchema = z.object({
  data: z.array(clinicalVitalResponseSchema),
});

export const clinicalRecordEnvelopeSchema = z.object({
  clinicalRecord: clinicalRecordResponseSchema.nullable(),
});

export type ClinicalEncounterStatus = z.infer<typeof clinicalEncounterStatusSchema>;
export type ClinicalAuditEntityType = z.infer<typeof clinicalAuditEntityTypeSchema>;
export type ClinicalAuditAction = z.infer<typeof clinicalAuditActionSchema>;
export type ClinicalRecordResponse = z.infer<typeof clinicalRecordResponseSchema>;
export type ClinicalEncounterResponse = z.infer<typeof clinicalEncounterResponseSchema>;
export type ClinicalEncounterListResponse = z.infer<typeof clinicalEncounterListResponseSchema>;
export type ClinicalVitalResponse = z.infer<typeof clinicalVitalResponseSchema>;
export type ClinicalEvolutionResponse = z.infer<typeof clinicalEvolutionResponseSchema>;
export type ClinicalEvolutionListResponse = z.infer<typeof clinicalEvolutionListResponseSchema>;
export type ClinicalVitalListResponse = z.infer<typeof clinicalVitalListResponseSchema>;
export type ClinicalRecordEnvelope = z.infer<typeof clinicalRecordEnvelopeSchema>;

const appointmentStatusSchema = z.enum([
  'SCHEDULED',
  'WAITING_ROOM',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]);

const appointmentSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.enum(['ACTIVE', 'ARCHIVED']),
});

const membershipSummarySchema = z.object({
  id: z.string().uuid(),
  role: membershipRoleSchema,
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    status: z.enum(['ACTIVE', 'SUSPENDED']),
  }),
});

export const appointmentResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  clinicLocationId: z.string().uuid(),
  patientId: z.string().uuid(),
  ownerId: z.string().uuid(),
  assignedMembershipId: z.string().uuid().nullable(),
  createdByMembershipId: z.string().uuid(),
  status: appointmentStatusSchema,
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  reason: z.string(),
  notes: z.string().nullable(),
  observations: z.string().nullable(),
  ownerConfirmedAt: z.string().datetime({ offset: true }).nullable(),
  clinicConfirmedAt: z.string().datetime({ offset: true }).nullable(),
  cancelledAt: z.string().datetime({ offset: true }).nullable(),
  cancelledByMembershipId: z.string().uuid().nullable(),
  cancellationReason: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  patient: appointmentSummarySchema,
  owner: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string().nullable(),
    status: z.enum(['ACTIVE', 'ARCHIVED']),
  }),
  clinicLocation: locationResponseSchema,
  assignedMembership: membershipSummarySchema.nullable(),
});

export const appointmentListResponseSchema = z.object({
  data: z.array(appointmentResponseSchema),
});

export const createAppointmentRequestSchema = z
  .object({
    clinicLocationId: z.string().uuid(),
    patientId: z.string().uuid(),
    ownerId: z.string().uuid(),
    assignedMembershipId: z.string().uuid().nullable().optional(),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    reason: z.string().trim().min(1).max(500),
    notes: optionalText(2000),
  })
  .strict();

export const rescheduleAppointmentRequestSchema = z
  .object({
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const cancelAppointmentRequestSchema = z
  .object({
    cancellationReason: optionalText(500),
  })
  .strict();

export const updateAppointmentRequestSchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional(),
    notes: optionalText(2000),
    assignedMembershipId: z.string().uuid().nullable().optional(),
  })
  .strict();

export const appointmentListQuerySchema = z
  .object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
    clinicLocationId: z.string().uuid().optional(),
    assignedMembershipId: z.string().uuid().optional(),
    patientId: z.string().uuid().optional(),
    status: appointmentStatusSchema.optional(),
  })
  .strict();

export const availabilityRuleResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  clinicLocationId: z.string().uuid(),
  membershipId: z.string().uuid().nullable(),
  dayOfWeek: z.number().int().min(0).max(6),
  startLocalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endLocalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  slotMinutes: z.number().int().min(15).max(240),
  notes: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const availabilityRuleRequestSchema = z
  .object({
    clinicLocationId: z.string().uuid(),
    membershipId: z.string().uuid().nullable().optional(),
    dayOfWeek: z.number().int().min(0).max(6),
    startLocalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endLocalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    slotMinutes: z.number().int().min(15).max(240).default(30),
    notes: optionalText(2000),
  })
  .strict();

export const availableSlotsResponseSchema = z.object({
  mode: z.enum(['RULES', 'UNRESTRICTED']),
  timezone: z.string(),
  date: z.string().date(),
  slots: z.array(
    z.object({
      startsAt: z.string().datetime({ offset: true }),
      endsAt: z.string().datetime({ offset: true }),
    }),
  ),
});

export type AppointmentStatusValue = z.infer<typeof appointmentStatusSchema>;
export type AppointmentResponse = z.infer<typeof appointmentResponseSchema>;
export type AppointmentListResponse = z.infer<typeof appointmentListResponseSchema>;
export type CreateAppointmentRequest = z.infer<typeof createAppointmentRequestSchema>;
export type RescheduleAppointmentRequest = z.infer<typeof rescheduleAppointmentRequestSchema>;
export type CancelAppointmentRequest = z.infer<typeof cancelAppointmentRequestSchema>;
export type UpdateAppointmentRequest = z.infer<typeof updateAppointmentRequestSchema>;
export type AppointmentListQuery = z.infer<typeof appointmentListQuerySchema>;
export type AvailabilityRuleResponse = z.infer<typeof availabilityRuleResponseSchema>;
export type AvailabilityRuleRequest = z.infer<typeof availabilityRuleRequestSchema>;
export type AvailableSlotsResponse = z.infer<typeof availableSlotsResponseSchema>;
