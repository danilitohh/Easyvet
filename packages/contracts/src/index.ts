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

// Professional profiles are tenant-scoped to the active membership; clients never submit
// organization, user or membership identifiers for the self-service endpoint.
export const professionalProfileResponseSchema = z.object({
  membershipId: z.string().uuid(),
  displayName: z.string(),
  licenseNumber: z.string().nullable(),
});

export const upsertProfessionalProfileRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(160),
    licenseNumber: z.string().trim().max(80).nullable().optional(),
  })
  .strict();

export const clinicalPractitionerResponseSchema = z.object({
  membershipId: z.string().uuid(),
  displayName: z.string().nullable(),
  licenseNumber: z.string().nullable(),
  profileConfigured: z.boolean(),
});

export const clinicalPractitionerListResponseSchema = z.object({
  data: z.array(clinicalPractitionerResponseSchema),
});

export type ProfessionalProfileResponse = z.infer<typeof professionalProfileResponseSchema>;
export type UpsertProfessionalProfileRequest = z.infer<
  typeof upsertProfessionalProfileRequestSchema
>;
export type ClinicalPractitionerResponse = z.infer<typeof clinicalPractitionerResponseSchema>;
export type ClinicalPractitionerListResponse = z.infer<
  typeof clinicalPractitionerListResponseSchema
>;

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
  'VACCINATION',
  'DEWORMING',
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
  authorDisplayName: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
});

export const clinicalEvolutionListResponseSchema = z.object({
  data: z.array(clinicalEvolutionResponseSchema),
  pagination: paginationSchema,
});

export const clinicalVitalListResponseSchema = z.object({
  data: z.array(clinicalVitalResponseSchema),
});

const clinicalNarrativeField = (max = 20_000) => z.string().trim().max(max).nullable().optional();
export const createClinicalEncounterRequestSchema = z
  .object({
    clinicLocationId: z.string().uuid(),
    appointmentId: z.string().uuid().nullable().optional(),
    responsibleMembershipId: z.string().uuid().nullable().optional(),
    occurredAt: z.string().datetime({ offset: true }),
    reason: z.string().trim().min(1).max(500),
    anamnesis: clinicalNarrativeField(),
    physicalExam: clinicalNarrativeField(),
    presumptiveDiagnosis: clinicalNarrativeField(),
    differentialDiagnosis: clinicalNarrativeField(),
    definitiveDiagnosis: clinicalNarrativeField(),
    diagnosticPlan: clinicalNarrativeField(),
    therapeuticPlan: clinicalNarrativeField(),
    recommendations: clinicalNarrativeField(),
    followUpPlan: clinicalNarrativeField(),
    notes: clinicalNarrativeField(),
  })
  .strict();

export const updateClinicalEncounterRequestSchema = createClinicalEncounterRequestSchema
  .omit({ clinicLocationId: true, occurredAt: true, reason: true })
  .extend({
    expectedVersion: z.number().int().positive(),
    clinicLocationId: z.string().uuid().optional(),
    occurredAt: z.string().datetime({ offset: true }).optional(),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const createClinicalVitalRequestSchema = z
  .object({
    measuredAt: z.string().datetime({ offset: true }),
    weightKg: z.number().positive().nullable().optional(),
    temperatureC: z.number().positive().nullable().optional(),
    heartRateBpm: z.number().int().positive().nullable().optional(),
    respiratoryRateBpm: z.number().int().positive().nullable().optional(),
    bodyCondition: clinicalNarrativeField(200),
    hydration: clinicalNarrativeField(200),
    mucousMembranes: clinicalNarrativeField(200),
    skinTurgor: clinicalNarrativeField(200),
    observations: clinicalNarrativeField(),
  })
  .strict();

export const finalizeClinicalEncounterRequestSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();

export const voidClinicalEncounterRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().min(1).max(2_000),
  })
  .strict();

export const createClinicalEvolutionRequestSchema = z
  .object({
    clinicalEncounterId: z.string().uuid().nullable().optional(),
    occurredAt: z.string().datetime({ offset: true }),
    subjective: clinicalNarrativeField(),
    objective: clinicalNarrativeField(),
    assessment: clinicalNarrativeField(),
    plan: clinicalNarrativeField(),
  })
  .strict();

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
export type CreateClinicalEncounterRequest = z.infer<typeof createClinicalEncounterRequestSchema>;
export type UpdateClinicalEncounterRequest = z.infer<typeof updateClinicalEncounterRequestSchema>;
export type CreateClinicalVitalRequest = z.infer<typeof createClinicalVitalRequestSchema>;
export type FinalizeClinicalEncounterRequest = z.infer<
  typeof finalizeClinicalEncounterRequestSchema
>;
export type VoidClinicalEncounterRequest = z.infer<typeof voidClinicalEncounterRequestSchema>;
export type CreateClinicalEvolutionRequest = z.infer<typeof createClinicalEvolutionRequestSchema>;

const prescriptionStatusSchema = z.enum(['DRAFT', 'FINALIZED', 'VOIDED']);

export const prescriptionItemSchema = z.object({
  id: z.string().uuid(),
  prescriptionId: z.string().uuid(),
  position: z.number().int().nonnegative(),
  medicationName: z.string(),
  presentation: z.string().nullable(),
  quantity: z.string().nullable(),
  dosage: z.string().nullable(),
  frequency: z.string().nullable(),
  duration: z.string().nullable(),
  observations: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
});

const prescriptionPatientSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: patientStatusSchema,
});

const prescriptionProfessionalSchema = z.object({
  membershipId: z.string().uuid(),
  displayName: z.string().nullable(),
  licenseNumber: z.string().nullable(),
});

const prescriptionSummaryFieldsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  clinicalEncounterId: z.string().uuid(),
  patientId: z.string().uuid(),
  status: prescriptionStatusSchema,
  itemCount: z.number().int().nonnegative(),
  version: z.number().int().positive(),
  prescribedByMembershipId: z.string().uuid().nullable(),
  createdByMembershipId: z.string().uuid(),
  professionalDisplayNameSnapshot: z.string().nullable(),
  professionalLicenseSnapshot: z.string().nullable(),
  patientNameSnapshot: z.string().nullable(),
  ownerDisplayNameSnapshot: z.string().nullable(),
  diagnosisSnapshot: z.string().nullable(),
  finalizedAt: z.string().datetime({ offset: true }).nullable(),
  finalizedByMembershipId: z.string().uuid().nullable(),
  voidedAt: z.string().datetime({ offset: true }).nullable(),
  voidedByMembershipId: z.string().uuid().nullable(),
  voidReason: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  parentEncounterStatus: clinicalEncounterStatusSchema,
  patient: prescriptionPatientSchema,
  prescribedBy: prescriptionProfessionalSchema.nullable(),
});

export const prescriptionSummarySchema = prescriptionSummaryFieldsSchema;
export const prescriptionDetailSchema = prescriptionSummaryFieldsSchema.extend({
  items: z.array(prescriptionItemSchema),
});

export const prescriptionListResponseSchema = z.object({
  data: z.array(prescriptionSummarySchema),
  pagination: paginationSchema,
});

const prescriptionItemRequestSchema = z
  .object({
    id: z.string().uuid().optional(),
    position: z.number().int().nonnegative().max(10_000),
    medicationName: z.string().trim().min(1).max(500),
    presentation: z.string().max(500).nullable().optional(),
    quantity: z.string().max(200).nullable().optional(),
    dosage: z.string().max(500).nullable().optional(),
    frequency: z.string().max(500).nullable().optional(),
    duration: z.string().max(500).nullable().optional(),
    observations: z.string().max(2_000).nullable().optional(),
  })
  .strict();

export const createPrescriptionRequestSchema = z
  .object({
    prescribedByMembershipId: z.string().uuid().nullable().optional(),
    items: z.array(prescriptionItemRequestSchema).max(100).optional(),
  })
  .strict();

export const updatePrescriptionRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    prescribedByMembershipId: z.string().uuid().nullable().optional(),
    items: z.array(prescriptionItemRequestSchema).max(100),
  })
  .strict();

export const finalizePrescriptionRequestSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();

export const voidPrescriptionRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().min(1).max(2_000),
  })
  .strict();

export const prescriptionListQuerySchema = z
  .object({
    page: pageSchema.default(1),
    pageSize: pageSizeSchema.default(20),
    status: prescriptionStatusSchema.optional(),
    clinicalEncounterId: z.string().uuid().optional(),
  })
  .strict();

export type PrescriptionStatus = z.infer<typeof prescriptionStatusSchema>;
export type PrescriptionItem = z.infer<typeof prescriptionItemSchema>;
export type PrescriptionSummary = z.infer<typeof prescriptionSummarySchema>;
export type PrescriptionDetail = z.infer<typeof prescriptionDetailSchema>;
export type PrescriptionListResponse = z.infer<typeof prescriptionListResponseSchema>;
export type CreatePrescriptionRequest = z.infer<typeof createPrescriptionRequestSchema>;
export type UpdatePrescriptionRequest = z.infer<typeof updatePrescriptionRequestSchema>;
export type FinalizePrescriptionRequest = z.infer<typeof finalizePrescriptionRequestSchema>;
export type VoidPrescriptionRequest = z.infer<typeof voidPrescriptionRequestSchema>;
export type PrescriptionListQuery = z.infer<typeof prescriptionListQuerySchema>;

// Preventive-care contracts keep civil dates as YYYY-MM-DD strings and never expose Prisma types.
const preventiveRecordStatusSchema = z.enum(['DRAFT', 'FINALIZED', 'VOIDED']);
const civilDateSchema = z.string().date();
const preventivePatientSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.enum(['ACTIVE', 'ARCHIVED']),
});
const preventiveEncounterSummarySchema = z.object({
  id: z.string().uuid(),
  status: clinicalEncounterStatusSchema,
});
const preventiveProfessionalSummarySchema = z.object({
  membershipId: z.string().uuid(),
  displayName: z.string().nullable(),
  licenseNumber: z.string().nullable(),
  clinicalRole: clinicalRoleSchema.nullable(),
});
const preventiveCommonResponseFieldsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  clinicalEncounterId: z.string().uuid(),
  patientId: z.string().uuid(),
  status: preventiveRecordStatusSchema,
  version: z.number().int().positive(),
  createdByMembershipId: z.string().uuid(),
  responsiblePractitionerMembershipId: z.string().uuid().nullable(),
  administeredByMembershipId: z.string().uuid().nullable(),
  patientNameSnapshot: z.string().nullable(),
  ownerDisplayNameSnapshot: z.string().nullable(),
  professionalDisplayNameSnapshot: z.string().nullable(),
  professionalLicenseSnapshot: z.string().nullable(),
  administeredByDisplayNameSnapshot: z.string().nullable(),
  finalizedAt: z.string().datetime({ offset: true }).nullable(),
  finalizedByMembershipId: z.string().uuid().nullable(),
  voidedAt: z.string().datetime({ offset: true }).nullable(),
  voidedByMembershipId: z.string().uuid().nullable(),
  voidReason: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  parentEncounterStatus: clinicalEncounterStatusSchema,
  patient: preventivePatientSummarySchema,
  encounter: preventiveEncounterSummarySchema,
  responsiblePractitioner: preventiveProfessionalSummarySchema.nullable(),
  administeredBy: preventiveProfessionalSummarySchema.nullable(),
});

export const vaccinationSummarySchema = preventiveCommonResponseFieldsSchema.extend({
  administeredOn: civilDateSchema.nullable(),
  nextDueOn: civilDateSchema.nullable(),
  vaccineName: z.string().nullable(),
  vaccineType: z.string().nullable(),
  route: z.string().nullable(),
  laboratoryName: z.string().nullable(),
  lotNumber: z.string().nullable(),
  expiryOn: civilDateSchema.nullable(),
  doseText: z.string().nullable(),
  notes: z.string().nullable(),
});
export const vaccinationDetailSchema = vaccinationSummarySchema;
export const dewormingSummarySchema = preventiveCommonResponseFieldsSchema.extend({
  administeredOn: civilDateSchema.nullable(),
  nextDueOn: civilDateSchema.nullable(),
  productName: z.string().nullable(),
  dewormingType: z.string().nullable(),
  doseText: z.string().nullable(),
  notes: z.string().nullable(),
});
export const dewormingDetailSchema = dewormingSummarySchema;

export const vaccinationListResponseSchema = z.object({
  data: z.array(vaccinationSummarySchema),
  pagination: paginationSchema,
});
export const dewormingListResponseSchema = z.object({
  data: z.array(dewormingSummarySchema),
  pagination: paginationSchema,
});

const preventiveListQuerySchema = z
  .object({
    page: pageSchema.default(1),
    pageSize: pageSizeSchema.default(20),
    status: preventiveRecordStatusSchema.optional(),
    clinicalEncounterId: z.string().uuid().optional(),
    from: civilDateSchema.optional(),
    to: civilDateSchema.optional(),
  })
  .strict();
export const vaccinationListQuerySchema = preventiveListQuerySchema;
export const dewormingListQuerySchema = preventiveListQuerySchema;

const vaccinationDraftFieldsSchema = {
  administeredOn: civilDateSchema.nullable().optional(),
  nextDueOn: civilDateSchema.nullable().optional(),
  vaccineName: z.string().trim().max(200).nullable().optional(),
  vaccineType: z.string().trim().max(120).nullable().optional(),
  route: z.string().trim().max(100).nullable().optional(),
  laboratoryName: z.string().trim().max(160).nullable().optional(),
  lotNumber: z.string().trim().max(120).nullable().optional(),
  expiryOn: civilDateSchema.nullable().optional(),
  doseText: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  responsiblePractitionerMembershipId: z.string().uuid().nullable().optional(),
  administeredByMembershipId: z.string().uuid().nullable().optional(),
};
const dewormingDraftFieldsSchema = {
  administeredOn: civilDateSchema.nullable().optional(),
  nextDueOn: civilDateSchema.nullable().optional(),
  productName: z.string().trim().max(200).nullable().optional(),
  dewormingType: z.string().trim().max(120).nullable().optional(),
  doseText: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  responsiblePractitionerMembershipId: z.string().uuid().nullable().optional(),
  administeredByMembershipId: z.string().uuid().nullable().optional(),
};

export const createVaccinationRequestSchema = z.object(vaccinationDraftFieldsSchema).strict();
export const updateVaccinationRequestSchema = z
  .object({ expectedVersion: z.number().int().positive(), ...vaccinationDraftFieldsSchema })
  .strict();
export const finalizeVaccinationRequestSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();
export const voidVaccinationRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();
export const createDewormingRequestSchema = z.object(dewormingDraftFieldsSchema).strict();
export const updateDewormingRequestSchema = z
  .object({ expectedVersion: z.number().int().positive(), ...dewormingDraftFieldsSchema })
  .strict();
export const finalizeDewormingRequestSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();
export const voidDewormingRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();

export type PreventiveRecordStatus = z.infer<typeof preventiveRecordStatusSchema>;
export type VaccinationSummary = z.infer<typeof vaccinationSummarySchema>;
export type VaccinationDetail = z.infer<typeof vaccinationDetailSchema>;
export type VaccinationListResponse = z.infer<typeof vaccinationListResponseSchema>;
export type VaccinationListQuery = z.infer<typeof vaccinationListQuerySchema>;
export type CreateVaccinationRequest = z.infer<typeof createVaccinationRequestSchema>;
export type UpdateVaccinationRequest = z.infer<typeof updateVaccinationRequestSchema>;
export type FinalizeVaccinationRequest = z.infer<typeof finalizeVaccinationRequestSchema>;
export type VoidVaccinationRequest = z.infer<typeof voidVaccinationRequestSchema>;
export type DewormingSummary = z.infer<typeof dewormingSummarySchema>;
export type DewormingDetail = z.infer<typeof dewormingDetailSchema>;
export type DewormingListResponse = z.infer<typeof dewormingListResponseSchema>;
export type DewormingListQuery = z.infer<typeof dewormingListQuerySchema>;
export type CreateDewormingRequest = z.infer<typeof createDewormingRequestSchema>;
export type UpdateDewormingRequest = z.infer<typeof updateDewormingRequestSchema>;
export type FinalizeDewormingRequest = z.infer<typeof finalizeDewormingRequestSchema>;
export type VoidDewormingRequest = z.infer<typeof voidDewormingRequestSchema>;

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
