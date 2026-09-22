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
  'procedures.read',
  'procedures.create',
  'procedures.updateDraft',
  'procedures.finalize',
  'procedures.void',
  'anesthesia.read',
  'anesthesia.create',
  'anesthesia.updateDraft',
  'anesthesia.finalize',
  'anesthesia.void',
  'hospitalizations.read',
  'hospitalizations.create',
  'hospitalizations.update',
  'hospitalizations.activate',
  'hospitalizations.discharge',
  'hospitalizations.void',
  'hospitalizations.entries.create',
  'diagnostics.read',
  'diagnostics.create',
  'diagnostics.updateDraft',
  'diagnostics.request',
  'diagnostics.result',
  'diagnostics.void',
  'documents.read',
  'documents.generate',
  'documents.upload',
  'documents.void',
  'consents.read',
  'consents.create',
  'consents.updateDraft',
  'consents.issue',
  'consents.void',
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

// Preventive-care selectors need both practitioners and clinical assistants while the
// historical practitioner lookup remains intentionally practitioner-only.
// The member selector only needs a stable identity, role and profile state. Do not
// expose license numbers (or other professional PII) to this list endpoint.
export const clinicalMemberResponseSchema = z.object({
  membershipId: z.string().uuid(),
  clinicalRole: clinicalRoleSchema,
  displayName: z.string().nullable(),
  profileConfigured: z.boolean(),
});

export const clinicalMemberListResponseSchema = z.object({
  data: z.array(clinicalMemberResponseSchema),
});

export type ProfessionalProfileResponse = z.infer<typeof professionalProfileResponseSchema>;
export type UpsertProfessionalProfileRequest = z.infer<
  typeof upsertProfessionalProfileRequestSchema
>;
export type ClinicalPractitionerResponse = z.infer<typeof clinicalPractitionerResponseSchema>;
export type ClinicalPractitionerListResponse = z.infer<
  typeof clinicalPractitionerListResponseSchema
>;
export type ClinicalMemberResponse = z.infer<typeof clinicalMemberResponseSchema>;
export type ClinicalMemberListResponse = z.infer<typeof clinicalMemberListResponseSchema>;

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
  'CLINICAL_PROCEDURE',
  'ANESTHESIA_RECORD',
  'HOSPITALIZATION',
  'DIAGNOSTIC_ORDER',
]);
export const clinicalAuditActionSchema = z.enum([
  'CREATED',
  'UPDATED',
  'FINALIZED',
  'VOIDED',
  'EVOLUTION_ADDED',
  'VITAL_ADDED',
  'PRESCRIPTION_CREATED',
  'PRESCRIPTION_UPDATED',
  'PRESCRIPTION_FINALIZED',
  'PRESCRIPTION_VOIDED',
  'HOSPITALIZATION_CREATED',
  'HOSPITALIZATION_UPDATED',
  'HOSPITALIZATION_ACTIVATED',
  'HOSPITALIZATION_ENTRY_ADDED',
  'HOSPITALIZATION_DISCHARGED',
  'HOSPITALIZATION_VOIDED',
  'DIAGNOSTIC_ORDER_CREATED',
  'DIAGNOSTIC_ORDER_UPDATED',
  'DIAGNOSTIC_ORDER_REQUESTED',
  'DIAGNOSTIC_ORDER_RESULTED',
  'DIAGNOSTIC_ORDER_VOIDED',
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

// Procedures contracts expose snapshots and aggregate surgery detail without coupling consumers to Prisma.
export const clinicalProcedureKindSchema = z.enum(['PROCEDURE', 'SURGERY']);
export const clinicalProcedureStatusSchema = z.enum(['DRAFT', 'FINALIZED', 'VOIDED']);
const procedureDateTimeSchema = z.string().datetime({ offset: true });
const procedureText = (max: number) => z.string().trim().max(max).nullable();

export const clinicalSurgeryDetailSchema = z
  .object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    clinicalProcedureId: z.string().uuid(),
    assistantMembershipId: z.string().uuid().nullable(),
    assistantDisplayNameSnapshot: z.string().nullable(),
    surgicalArea: z.string().nullable(),
    surgicalSide: z.string().nullable(),
    bleedingNotes: z.string().nullable(),
    closureNotes: z.string().nullable(),
    createdAt: procedureDateTimeSchema,
    updatedAt: procedureDateTimeSchema,
    assistant: preventiveProfessionalSummarySchema.nullable(),
  })
  .strict();

const clinicalProcedureResponseBaseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  clinicalEncounterId: z.string().uuid(),
  patientId: z.string().uuid(),
  kind: clinicalProcedureKindSchema,
  status: clinicalProcedureStatusSchema,
  version: z.number().int().positive(),
  procedureName: z.string().nullable(),
  performedAt: procedureDateTimeSchema.nullable(),
  indication: z.string().nullable(),
  description: z.string().nullable(),
  responsiblePractitionerMembershipId: z.string().uuid().nullable(),
  patientNameSnapshot: z.string().nullable(),
  ownerDisplayNameSnapshot: z.string().nullable(),
  professionalDisplayNameSnapshot: z.string().nullable(),
  professionalLicenseSnapshot: z.string().nullable(),
  finalizedAt: procedureDateTimeSchema.nullable(),
  finalizedByMembershipId: z.string().uuid().nullable(),
  voidedAt: procedureDateTimeSchema.nullable(),
  voidedByMembershipId: z.string().uuid().nullable(),
  voidReason: z.string().nullable(),
  createdByMembershipId: z.string().uuid(),
  createdAt: procedureDateTimeSchema,
  updatedAt: procedureDateTimeSchema,
  parentEncounterStatus: clinicalEncounterStatusSchema,
  patient: preventivePatientSummarySchema,
  encounter: preventiveEncounterSummarySchema,
  responsiblePractitioner: preventiveProfessionalSummarySchema.nullable(),
});

export const clinicalProcedureSummarySchema = clinicalProcedureResponseBaseSchema
  .pick({
    id: true,
    organizationId: true,
    clinicalEncounterId: true,
    patientId: true,
    kind: true,
    status: true,
    version: true,
    procedureName: true,
    performedAt: true,
    responsiblePractitionerMembershipId: true,
    patientNameSnapshot: true,
    ownerDisplayNameSnapshot: true,
    professionalDisplayNameSnapshot: true,
    professionalLicenseSnapshot: true,
    finalizedAt: true,
    voidedAt: true,
    createdAt: true,
    updatedAt: true,
    parentEncounterStatus: true,
    patient: true,
    encounter: true,
    responsiblePractitioner: true,
  })
  .strict();

export const clinicalProcedureDetailSchema = clinicalProcedureResponseBaseSchema
  .extend({
    indication: z.string().nullable(),
    description: z.string().nullable(),
    technique: z.string().nullable(),
    findings: z.string().nullable(),
    complications: z.string().nullable(),
    recoveryNotes: z.string().nullable(),
    postoperativePlan: z.string().nullable(),
    notes: z.string().nullable(),
    surgeryDetail: clinicalSurgeryDetailSchema.nullable(),
  })
  .strict();

export const clinicalProcedureListResponseSchema = z.object({
  data: z.array(clinicalProcedureSummarySchema),
  pagination: paginationSchema,
});

const clinicalSurgeryDetailInputSchema = z
  .object({
    assistantMembershipId: z.string().uuid().nullable().optional(),
    surgicalArea: procedureText(500).optional(),
    surgicalSide: procedureText(200).optional(),
    bleedingNotes: procedureText(5000).optional(),
    closureNotes: procedureText(5000).optional(),
  })
  .strict();

const clinicalProcedureEditableFieldsSchema = {
  responsiblePractitionerMembershipId: z.string().uuid().nullable().optional(),
  procedureName: procedureText(200).optional(),
  performedAt: procedureDateTimeSchema.nullable().optional(),
  indication: procedureText(5000).optional(),
  description: procedureText(10000).optional(),
  technique: procedureText(10000).optional(),
  findings: procedureText(10000).optional(),
  complications: procedureText(10000).optional(),
  recoveryNotes: procedureText(10000).optional(),
  postoperativePlan: procedureText(10000).optional(),
  notes: procedureText(10000).optional(),
};

export const createClinicalProcedureRequestSchema = z
  .object({
    kind: clinicalProcedureKindSchema,
    ...clinicalProcedureEditableFieldsSchema,
    surgeryDetail: clinicalSurgeryDetailInputSchema.nullable().optional(),
  })
  .strict();

export const updateClinicalProcedureRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    kind: clinicalProcedureKindSchema.optional(),
    ...clinicalProcedureEditableFieldsSchema,
    surgeryDetail: clinicalSurgeryDetailInputSchema.nullable().optional(),
  })
  .strict();

export const finalizeClinicalProcedureRequestSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();
export const voidClinicalProcedureRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();

export const clinicalProcedureListQuerySchema = z
  .object({
    page: pageSchema.default(1),
    pageSize: pageSizeSchema.default(20),
    status: clinicalProcedureStatusSchema.optional(),
    kind: clinicalProcedureKindSchema.optional(),
    clinicalEncounterId: z.string().uuid().optional(),
    from: procedureDateTimeSchema.optional(),
    to: procedureDateTimeSchema.optional(),
  })
  .strict()
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: 'from must be on or before to',
    path: ['from'],
  });

export type ClinicalProcedureKind = z.infer<typeof clinicalProcedureKindSchema>;
export type ClinicalProcedureStatus = z.infer<typeof clinicalProcedureStatusSchema>;
export type ClinicalSurgeryDetail = z.infer<typeof clinicalSurgeryDetailSchema>;
export type ClinicalProcedureSummary = z.infer<typeof clinicalProcedureSummarySchema>;
export type ClinicalProcedureDetail = z.infer<typeof clinicalProcedureDetailSchema>;
export type ClinicalProcedureListResponse = z.infer<typeof clinicalProcedureListResponseSchema>;
export type CreateClinicalProcedureRequest = z.infer<typeof createClinicalProcedureRequestSchema>;
export type UpdateClinicalProcedureRequest = z.infer<typeof updateClinicalProcedureRequestSchema>;
export type FinalizeClinicalProcedureRequest = z.infer<
  typeof finalizeClinicalProcedureRequestSchema
>;
export type VoidClinicalProcedureRequest = z.infer<typeof voidClinicalProcedureRequestSchema>;
export type ClinicalProcedureListQuery = z.infer<typeof clinicalProcedureListQuerySchema>;

// Anesthesia contracts model an independent clinical aggregate and its ordered monitoring rows.
export const anesthesiaRecordStatusSchema = z.enum(['DRAFT', 'FINALIZED', 'VOIDED']);
const anesthesiaDateTimeSchema = z.string().datetime({ offset: true });
const anesthesiaText = (max: number) => z.string().trim().max(max).nullable();
const anesthesiaObservationFieldsSchema = {
  observedAt: anesthesiaDateTimeSchema,
  heartRateBpm: z.number().int().min(0).nullable().optional(),
  respiratoryRatePerMinute: z.number().int().min(0).nullable().optional(),
  temperatureC: z.number().positive().nullable().optional(),
  bloodPressureText: anesthesiaText(200).optional(),
  spo2Percent: z.number().min(0).max(100).nullable().optional(),
  etco2MmHg: z.number().min(0).nullable().optional(),
  anestheticPlane: anesthesiaText(500).optional(),
  notes: anesthesiaText(5000).optional(),
};
const anesthesiaEditableFieldsSchema = {
  clinicalProcedureId: z.string().uuid().nullable().optional(),
  startedAt: anesthesiaDateTimeSchema.nullable().optional(),
  endedAt: anesthesiaDateTimeSchema.nullable().optional(),
  asaClassification: anesthesiaText(100).optional(),
  technique: anesthesiaText(10000).optional(),
  preAnestheticAssessment: anesthesiaText(10000).optional(),
  medicationsText: anesthesiaText(10000).optional(),
  airwayManagement: anesthesiaText(5000).optional(),
  fluidsText: anesthesiaText(10000).optional(),
  complications: anesthesiaText(10000).optional(),
  recoveryNotes: anesthesiaText(10000).optional(),
  notes: anesthesiaText(10000).optional(),
  responsiblePractitionerMembershipId: z.string().uuid().nullable().optional(),
};

export const anesthesiaObservationSchema = z
  .object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    anesthesiaRecordId: z.string().uuid(),
    observedAt: anesthesiaDateTimeSchema,
    heartRateBpm: z.number().int().nonnegative().nullable(),
    respiratoryRatePerMinute: z.number().int().nonnegative().nullable(),
    temperatureC: z.number().positive().nullable(),
    bloodPressureText: z.string().nullable(),
    spo2Percent: z.number().min(0).max(100).nullable(),
    etco2MmHg: z.number().min(0).nullable(),
    anestheticPlane: z.string().nullable(),
    notes: z.string().nullable(),
    createdAt: anesthesiaDateTimeSchema,
    updatedAt: anesthesiaDateTimeSchema,
  })
  .strict();

const linkedProcedureSummarySchema = z
  .object({
    id: z.string().uuid(),
    kind: clinicalProcedureKindSchema,
    status: clinicalProcedureStatusSchema,
    procedureName: z.string().nullable(),
  })
  .strict();

const anesthesiaRecordResponseBaseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  clinicalEncounterId: z.string().uuid(),
  clinicalProcedureId: z.string().uuid().nullable(),
  patientId: z.string().uuid(),
  status: anesthesiaRecordStatusSchema,
  version: z.number().int().positive(),
  startedAt: anesthesiaDateTimeSchema.nullable(),
  endedAt: anesthesiaDateTimeSchema.nullable(),
  asaClassification: z.string().nullable(),
  technique: z.string().nullable(),
  preAnestheticAssessment: z.string().nullable(),
  medicationsText: z.string().nullable(),
  airwayManagement: z.string().nullable(),
  fluidsText: z.string().nullable(),
  complications: z.string().nullable(),
  recoveryNotes: z.string().nullable(),
  notes: z.string().nullable(),
  createdByMembershipId: z.string().uuid(),
  responsiblePractitionerMembershipId: z.string().uuid().nullable(),
  patientNameSnapshot: z.string().nullable(),
  ownerDisplayNameSnapshot: z.string().nullable(),
  professionalDisplayNameSnapshot: z.string().nullable(),
  professionalLicenseSnapshot: z.string().nullable(),
  finalizedAt: anesthesiaDateTimeSchema.nullable(),
  finalizedByMembershipId: z.string().uuid().nullable(),
  voidedAt: anesthesiaDateTimeSchema.nullable(),
  voidedByMembershipId: z.string().uuid().nullable(),
  voidReason: z.string().nullable(),
  createdAt: anesthesiaDateTimeSchema,
  updatedAt: anesthesiaDateTimeSchema,
  parentEncounterStatus: clinicalEncounterStatusSchema,
  linkedProcedureStatus: clinicalProcedureStatusSchema.nullable(),
  patient: preventivePatientSummarySchema,
  encounter: preventiveEncounterSummarySchema,
  linkedProcedure: linkedProcedureSummarySchema.nullable(),
  responsiblePractitioner: preventiveProfessionalSummarySchema.nullable(),
  observationCount: z.number().int().nonnegative(),
});

export const anesthesiaRecordSummarySchema = anesthesiaRecordResponseBaseSchema
  .pick({
    id: true,
    organizationId: true,
    clinicalEncounterId: true,
    clinicalProcedureId: true,
    patientId: true,
    status: true,
    version: true,
    startedAt: true,
    endedAt: true,
    responsiblePractitionerMembershipId: true,
    patientNameSnapshot: true,
    ownerDisplayNameSnapshot: true,
    professionalDisplayNameSnapshot: true,
    professionalLicenseSnapshot: true,
    finalizedAt: true,
    voidedAt: true,
    createdAt: true,
    updatedAt: true,
    parentEncounterStatus: true,
    linkedProcedureStatus: true,
    patient: true,
    encounter: true,
    linkedProcedure: true,
    responsiblePractitioner: true,
    observationCount: true,
  })
  .strict();
export const anesthesiaRecordDetailSchema = anesthesiaRecordResponseBaseSchema.strict();
export const anesthesiaRecordListResponseSchema = z.object({
  data: z.array(anesthesiaRecordSummarySchema),
  pagination: paginationSchema,
});
export const anesthesiaObservationListResponseSchema = z.object({
  data: z.array(anesthesiaObservationSchema),
  pagination: paginationSchema,
});
export const anesthesiaObservationMutationResponseSchema = z.object({
  anesthesiaRecordVersion: z.number().int().positive(),
  observation: anesthesiaObservationSchema.nullable(),
});

export const createAnesthesiaRecordRequestSchema = z
  .object(anesthesiaEditableFieldsSchema)
  .strict();
export const updateAnesthesiaRecordRequestSchema = z
  .object({ expectedVersion: z.number().int().positive(), ...anesthesiaEditableFieldsSchema })
  .strict();
export const finalizeAnesthesiaRecordRequestSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();
export const voidAnesthesiaRecordRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();
export const anesthesiaRecordListQuerySchema = z
  .object({
    page: pageSchema.default(1),
    pageSize: pageSizeSchema.default(20),
    status: anesthesiaRecordStatusSchema.optional(),
    clinicalEncounterId: z.string().uuid().optional(),
    clinicalProcedureId: z.string().uuid().optional(),
    from: anesthesiaDateTimeSchema.optional(),
    to: anesthesiaDateTimeSchema.optional(),
  })
  .strict()
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: 'from must be on or before to',
    path: ['from'],
  });
export const anesthesiaObservationListQuerySchema = z
  .object({
    page: pageSchema.default(1),
    pageSize: pageSizeSchema.default(20),
  })
  .strict();
export const createAnesthesiaObservationRequestSchema = z
  .object({ expectedVersion: z.number().int().positive(), ...anesthesiaObservationFieldsSchema })
  .strict();
export const updateAnesthesiaObservationRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    observedAt: anesthesiaDateTimeSchema.optional(),
    heartRateBpm: z.number().int().min(0).nullable().optional(),
    respiratoryRatePerMinute: z.number().int().min(0).nullable().optional(),
    temperatureC: z.number().positive().nullable().optional(),
    bloodPressureText: anesthesiaText(200).optional(),
    spo2Percent: z.number().min(0).max(100).nullable().optional(),
    etco2MmHg: z.number().min(0).nullable().optional(),
    anestheticPlane: anesthesiaText(500).optional(),
    notes: anesthesiaText(5000).optional(),
  })
  .strict();
export const removeAnesthesiaObservationRequestSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();

export type AnesthesiaRecordStatus = z.infer<typeof anesthesiaRecordStatusSchema>;
export type AnesthesiaObservation = z.infer<typeof anesthesiaObservationSchema>;
export type AnesthesiaRecordSummary = z.infer<typeof anesthesiaRecordSummarySchema>;
export type AnesthesiaRecordDetail = z.infer<typeof anesthesiaRecordDetailSchema>;

// Shared schemas keep hospitalization payloads independent from Prisma model types.
export const hospitalizationStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'DISCHARGED', 'VOIDED']);
export const hospitalizationEntryTypeSchema = z.enum([
  'EVOLUTION',
  'MONITORING',
  'MEDICATION',
  'NURSING',
  'DIET',
  'OTHER',
]);
const nullableText = (max: number) => z.string().max(max).nullable();
const offsetDateTimeSchema = z.string().datetime({ offset: true });

export const hospitalizationSummarySchema = z.object({
  id: z.string().uuid(),
  clinicalEncounterId: z.string().uuid(),
  patientId: z.string().uuid(),
  status: hospitalizationStatusSchema,
  version: z.number().int().min(1),
  admittedAt: z.string().datetime().nullable(),
  dischargedAt: z.string().datetime().nullable(),
  locationName: nullableText(160),
  admissionReason: nullableText(5000),
  diagnosis: nullableText(10000),
  patientNameSnapshot: nullableText(200),
  ownerDisplayNameSnapshot: nullableText(300),
  professionalDisplayNameSnapshot: nullableText(200),
  professionalLicenseSnapshot: nullableText(120),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const hospitalizationListResponseSchema = z.object({
  data: z.array(hospitalizationSummarySchema),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});
export const hospitalizationEntrySchema = z.object({
  id: z.string().uuid(),
  hospitalizationId: z.string().uuid(),
  entryType: hospitalizationEntryTypeSchema,
  recordedAt: z.string().datetime(),
  content: nullableText(10000),
  temperatureC: z.number().positive().nullable(),
  heartRateBpm: z.number().int().min(0).nullable(),
  respiratoryRatePerMinute: z.number().int().min(0).nullable(),
  weightKg: z.number().positive().nullable(),
  recordedByMembershipId: z.string().uuid(),
  recordedByDisplayName: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export const hospitalizationEntriesResponseSchema = z.object({
  data: z.array(hospitalizationEntrySchema),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});
export const hospitalizationDetailSchema = hospitalizationSummarySchema.extend({
  organizationId: z.string().uuid(),
  parentEncounterStatus: clinicalEncounterStatusSchema,
  responsiblePractitionerMembershipId: z.string().uuid().nullable(),
  createdByMembershipId: z.string().uuid(),
  activatedAt: z.string().datetime().nullable(),
  activatedByMembershipId: z.string().uuid().nullable(),
  dischargedByMembershipId: z.string().uuid().nullable(),
  voidedAt: z.string().datetime().nullable(),
  voidedByMembershipId: z.string().uuid().nullable(),
  voidReason: nullableText(1000),
  treatmentPlan: nullableText(10000),
  medicationsText: nullableText(10000),
  dietInstructions: nullableText(5000),
  dischargeSummary: nullableText(10000),
  dischargeRecommendations: nullableText(10000),
  notes: nullableText(10000),
  entryCount: z.number().int().min(0),
  patient: z.object({
    id: z.string().uuid(),
    name: z.string(),
    status: z.enum(['ACTIVE', 'ARCHIVED']),
  }),
});
export const createHospitalizationRequestSchema = z.object({
  admittedAt: offsetDateTimeSchema.nullable().optional(),
  locationName: nullableText(160).optional(),
  admissionReason: nullableText(5000).optional(),
  diagnosis: nullableText(10000).optional(),
  treatmentPlan: nullableText(10000).optional(),
  medicationsText: nullableText(10000).optional(),
  dietInstructions: nullableText(5000).optional(),
  notes: nullableText(10000).optional(),
  responsiblePractitionerMembershipId: z.string().uuid().nullable().optional(),
});
export const updateHospitalizationRequestSchema = createHospitalizationRequestSchema
  .partial()
  .extend({ expectedVersion: z.number().int().min(1) });
export const activateHospitalizationRequestSchema = z.object({
  expectedVersion: z.number().int().min(1),
});
export const dischargeHospitalizationRequestSchema = z.object({
  expectedVersion: z.number().int().min(1),
  dischargedAt: offsetDateTimeSchema,
  dischargeSummary: nullableText(10000).optional(),
  dischargeRecommendations: nullableText(10000).optional(),
});
export const voidHospitalizationRequestSchema = z.object({
  expectedVersion: z.number().int().min(1),
  reason: z.string().trim().min(1).max(1000),
});
export const createHospitalizationEntryRequestSchema = z.object({
  expectedVersion: z.number().int().min(1),
  entryType: hospitalizationEntryTypeSchema,
  recordedAt: offsetDateTimeSchema,
  content: nullableText(10000).optional(),
  temperatureC: z.number().positive().nullable().optional(),
  heartRateBpm: z.number().int().min(0).nullable().optional(),
  respiratoryRatePerMinute: z.number().int().min(0).nullable().optional(),
  weightKg: z.number().positive().nullable().optional(),
});
export const hospitalizationDetailResponseSchema = hospitalizationDetailSchema;
export type HospitalizationStatusValue = z.infer<typeof hospitalizationStatusSchema>;
export type HospitalizationEntryTypeValue = z.infer<typeof hospitalizationEntryTypeSchema>;
export type HospitalizationSummary = z.infer<typeof hospitalizationSummarySchema>;
export type HospitalizationListResponse = z.infer<typeof hospitalizationListResponseSchema>;
export type HospitalizationEntry = z.infer<typeof hospitalizationEntrySchema>;
export type HospitalizationEntriesResponse = z.infer<typeof hospitalizationEntriesResponseSchema>;
export type HospitalizationDetail = z.infer<typeof hospitalizationDetailSchema>;
export type CreateHospitalizationRequest = z.infer<typeof createHospitalizationRequestSchema>;
export type UpdateHospitalizationRequest = z.infer<typeof updateHospitalizationRequestSchema>;
export type ActivateHospitalizationRequest = z.infer<typeof activateHospitalizationRequestSchema>;
export type DischargeHospitalizationRequest = z.infer<typeof dischargeHospitalizationRequestSchema>;
export type VoidHospitalizationRequest = z.infer<typeof voidHospitalizationRequestSchema>;
export type CreateHospitalizationEntryRequest = z.infer<
  typeof createHospitalizationEntryRequestSchema
>;

// Diagnostic order contracts model request, result, and void as one tenant-scoped lifecycle.
export const diagnosticCategorySchema = z.enum(['LABORATORY', 'IMAGING', 'PATHOLOGY', 'OTHER']);
export const diagnosticOrderStatusSchema = z.enum(['DRAFT', 'REQUESTED', 'RESULTED', 'VOIDED']);
const diagnosticDateTimeSchema = z.string().datetime({ offset: true });
const diagnosticNullableText = (max: number) => z.string().trim().max(max).nullable();
const diagnosticOptionalText = (max: number) => diagnosticNullableText(max).optional();
const diagnosticActorSchema = z.object({
  membershipId: z.string().uuid(),
  displayName: z.string().nullable(),
  licenseNumber: z.string().nullable(),
});

export const diagnosticOrderSummarySchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  clinicalEncounterId: z.string().uuid(),
  patientId: z.string().uuid(),
  category: diagnosticCategorySchema,
  status: diagnosticOrderStatusSchema,
  version: z.number().int().positive(),
  testName: diagnosticNullableText(300),
  requestedAt: diagnosticDateTimeSchema.nullable(),
  responsiblePractitionerMembershipId: z.string().uuid().nullable(),
  createdByMembershipId: z.string().uuid(),
  patientNameSnapshot: diagnosticNullableText(200),
  ownerDisplayNameSnapshot: diagnosticNullableText(300),
  professionalDisplayNameSnapshot: diagnosticNullableText(200),
  professionalLicenseSnapshot: diagnosticNullableText(160),
  requestedByMembershipId: z.string().uuid().nullable(),
  resultedAt: diagnosticDateTimeSchema.nullable(),
  voidedAt: diagnosticDateTimeSchema.nullable(),
  createdAt: diagnosticDateTimeSchema,
  updatedAt: diagnosticDateTimeSchema,
  parentEncounterStatus: clinicalEncounterStatusSchema,
  patient: z.object({
    id: z.string().uuid(),
    name: z.string(),
    status: patientStatusSchema,
  }),
  encounter: z.object({
    id: z.string().uuid(),
    status: clinicalEncounterStatusSchema,
    occurredAt: diagnosticDateTimeSchema,
    reason: z.string(),
  }),
  responsiblePractitioner: diagnosticActorSchema.nullable(),
});

export const diagnosticOrderDetailSchema = diagnosticOrderSummarySchema.extend({
  reason: diagnosticNullableText(5000),
  instructions: diagnosticNullableText(10000),
  notes: diagnosticNullableText(10000),
  requestedBy: diagnosticActorSchema.nullable(),
  resultText: diagnosticNullableText(20000),
  interpretation: diagnosticNullableText(10000),
  resultedByMembershipId: z.string().uuid().nullable(),
  resultedBy: diagnosticActorSchema.nullable(),
  voidedByMembershipId: z.string().uuid().nullable(),
  voidReason: diagnosticNullableText(1000),
  voidedByDisplayName: z.string().nullable(),
});

export const diagnosticOrderListResponseSchema = z.object({
  data: z.array(diagnosticOrderSummarySchema),
  pagination: paginationSchema,
});

const diagnosticEditableFieldsSchema = {
  testName: diagnosticOptionalText(300),
  requestedAt: diagnosticDateTimeSchema.nullable().optional(),
  reason: diagnosticOptionalText(5000),
  instructions: diagnosticOptionalText(10000),
  notes: diagnosticOptionalText(10000),
  responsiblePractitionerMembershipId: z.string().uuid().nullable().optional(),
};

export const createDiagnosticOrderRequestSchema = z
  .object({ category: diagnosticCategorySchema, ...diagnosticEditableFieldsSchema })
  .strict();
export const updateDiagnosticOrderRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    category: diagnosticCategorySchema.optional(),
    ...diagnosticEditableFieldsSchema,
  })
  .strict();
export const requestDiagnosticOrderRequestSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();
export const resultDiagnosticOrderRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    resultedAt: diagnosticDateTimeSchema,
    resultText: diagnosticOptionalText(20000),
    interpretation: diagnosticOptionalText(10000),
  })
  .strict()
  .refine(
    ({ resultText, interpretation }) => Boolean(resultText?.trim() || interpretation?.trim()),
    { message: 'At least one result field is required', path: ['resultText'] },
  );
export const voidDiagnosticOrderRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();

export const diagnosticOrderListQuerySchema = z
  .object({
    page: pageSchema.default(1),
    pageSize: pageSizeSchema.default(20),
    status: diagnosticOrderStatusSchema.optional(),
    category: diagnosticCategorySchema.optional(),
    clinicalEncounterId: z.string().uuid().optional(),
    from: diagnosticDateTimeSchema.optional(),
    to: diagnosticDateTimeSchema.optional(),
  })
  .strict()
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: 'from must be on or before to',
    path: ['from'],
  });

export type DiagnosticCategory = z.infer<typeof diagnosticCategorySchema>;
export type DiagnosticOrderStatus = z.infer<typeof diagnosticOrderStatusSchema>;
export type DiagnosticOrderSummary = z.infer<typeof diagnosticOrderSummarySchema>;
export type DiagnosticOrderDetail = z.infer<typeof diagnosticOrderDetailSchema>;
export type DiagnosticOrderListResponse = z.infer<typeof diagnosticOrderListResponseSchema>;
export type CreateDiagnosticOrderRequest = z.infer<typeof createDiagnosticOrderRequestSchema>;
export type UpdateDiagnosticOrderRequest = z.infer<typeof updateDiagnosticOrderRequestSchema>;
export type RequestDiagnosticOrderRequest = z.infer<typeof requestDiagnosticOrderRequestSchema>;
export type ResultDiagnosticOrderRequest = z.infer<typeof resultDiagnosticOrderRequestSchema>;
export type VoidDiagnosticOrderRequest = z.infer<typeof voidDiagnosticOrderRequestSchema>;
export type DiagnosticOrderListQuery = z.infer<typeof diagnosticOrderListQuerySchema>;

export type AnesthesiaRecordListResponse = z.infer<typeof anesthesiaRecordListResponseSchema>;
export type AnesthesiaObservationListResponse = z.infer<
  typeof anesthesiaObservationListResponseSchema
>;
export type AnesthesiaObservationMutationResponse = z.infer<
  typeof anesthesiaObservationMutationResponseSchema
>;
export type CreateAnesthesiaRecordRequest = z.infer<typeof createAnesthesiaRecordRequestSchema>;
export type UpdateAnesthesiaRecordRequest = z.infer<typeof updateAnesthesiaRecordRequestSchema>;
export type FinalizeAnesthesiaRecordRequest = z.infer<typeof finalizeAnesthesiaRecordRequestSchema>;
export type VoidAnesthesiaRecordRequest = z.infer<typeof voidAnesthesiaRecordRequestSchema>;
export type AnesthesiaRecordListQuery = z.infer<typeof anesthesiaRecordListQuerySchema>;
export type AnesthesiaObservationListQuery = z.infer<typeof anesthesiaObservationListQuerySchema>;
export type CreateAnesthesiaObservationRequest = z.infer<
  typeof createAnesthesiaObservationRequestSchema
>;
export type UpdateAnesthesiaObservationRequest = z.infer<
  typeof updateAnesthesiaObservationRequestSchema
>;
export type RemoveAnesthesiaObservationRequest = z.infer<
  typeof removeAnesthesiaObservationRequestSchema
>;
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

// Clinical document contracts keep upload, generated-artifact, and download metadata typed at both app boundaries.
export const clinicalDocumentOriginSchema = z.enum(['GENERATED', 'UPLOADED']);
export const clinicalDocumentStatusSchema = z.enum(['ACTIVE', 'VOIDED']);
export const clinicalDocumentTypeSchema = z.enum([
  'PRESCRIPTION',
  'VACCINATION_CERTIFICATE',
  'PROCEDURE_REPORT',
  'ANESTHESIA_REPORT',
  'HOSPITALIZATION_DISCHARGE',
  'DIAGNOSTIC_RESULT',
  'SIGNED_CONSENT',
  'CLINICAL_ATTACHMENT',
]);
export const clinicalDocumentSourceTypeSchema = z.enum([
  'PRESCRIPTION',
  'VACCINATION',
  'CLINICAL_PROCEDURE',
  'ANESTHESIA_RECORD',
  'HOSPITALIZATION',
  'DIAGNOSTIC_ORDER',
  'CONSENT',
]);
export const generatedClinicalDocumentTypeSchema = clinicalDocumentTypeSchema.exclude([
  'CLINICAL_ATTACHMENT',
]);
export const clinicalDocumentMetadataSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  clinicalEncounterId: z.string().uuid().nullable(),
  origin: clinicalDocumentOriginSchema,
  status: clinicalDocumentStatusSchema,
  documentType: clinicalDocumentTypeSchema,
  title: z.string(),
  originalFileName: z.string().nullable(),
  sourceType: clinicalDocumentSourceTypeSchema.nullable(),
  sourceId: z.string().uuid().nullable(),
  sourceVersion: z.number().int().nullable(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().length(64),
  voidReason: z.string().nullable(),
  voidedAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  sourceStatus: z.string().nullable().optional(),
});
export const clinicalDocumentListResponseSchema = z.object({
  data: z.array(clinicalDocumentMetadataSchema),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  }),
});
export const generateClinicalDocumentRequestSchema = z.object({
  documentType: generatedClinicalDocumentTypeSchema,
  sourceId: z.string().uuid(),
});
export const consentStatusSchema = z.enum(['DRAFT', 'ISSUED', 'SIGNED', 'VOIDED']);
export const consentSignatureMethodSchema = z.enum(['TYPED', 'DRAWN']);
export const consentDetailSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  patientId: z.string().uuid(),
  clinicalEncounterId: z.string().uuid(),
  clinicalProcedureId: z.string().uuid().nullable(),
  status: consentStatusSchema,
  version: z.number().int().min(1),
  title: z.string(),
  purposeText: z.string().nullable(),
  risksText: z.string().nullable(),
  benefitsText: z.string().nullable(),
  alternativesText: z.string().nullable(),
  estimatedCostText: z.string().nullable(),
  declarationText: z.string().nullable(),
  responsiblePractitionerMembershipId: z.string().uuid().nullable(),
  patientNameSnapshot: z.string().nullable(),
  ownerDisplayNameSnapshot: z.string().nullable(),
  ownerDocumentTypeSnapshot: z.string().nullable(),
  ownerDocumentNumberSnapshot: z.string().nullable(),
  professionalDisplayNameSnapshot: z.string().nullable(),
  professionalLicenseSnapshot: z.string().nullable(),
  contentSha256: z.string().length(64).nullable(),
  issuedAt: z.string().datetime({ offset: true }).nullable(),
  signedAt: z.string().datetime({ offset: true }).nullable(),
  voidedAt: z.string().datetime({ offset: true }).nullable(),
  voidReason: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  encounterStatus: z.enum(['DRAFT', 'FINALIZED', 'VOIDED']),
  procedureStatus: z.string().nullable(),
  patientStatus: z.enum(['ACTIVE', 'ARCHIVED']),
  signerName: z.string().nullable(),
  signatureMethod: consentSignatureMethodSchema.nullable(),
  signedDocumentId: z.string().uuid().nullable(),
});
export const consentCreateRequestSchema = z.object({
  title: z.string().trim().max(300).optional(),
  purposeText: optionalText(10000),
  risksText: optionalText(10000),
  benefitsText: optionalText(10000),
  alternativesText: optionalText(10000),
  estimatedCostText: optionalText(2000),
  declarationText: optionalText(10000),
  responsiblePractitionerMembershipId: z.string().uuid().nullable().optional(),
  clinicalProcedureId: z.string().uuid().nullable().optional(),
});
export const consentUpdateDraftRequestSchema = consentCreateRequestSchema.extend({
  expectedVersion: z.number().int().min(1),
});
export const consentExpectedVersionRequestSchema = z.object({
  expectedVersion: z.number().int().min(1),
});
export const consentVoidRequestSchema = consentExpectedVersionRequestSchema.extend({
  reason: z.string().trim().min(1).max(1000),
});
export const signatureIssueResponseSchema = z.object({
  consent: consentDetailSchema,
  signingPath: z.string().startsWith('/firmar/'),
  verificationCode: z.string().regex(/^\d{6}$/),
  expiresAt: z.string().datetime({ offset: true }),
});
export const publicConsentSchema = z.object({
  organizationDisplayName: z.string(),
  patientName: z.string(),
  ownerDisplayName: z.string(),
  ownerDocumentMasked: z.string().nullable(),
  title: z.string(),
  purposeText: z.string().nullable(),
  risksText: z.string().nullable(),
  benefitsText: z.string().nullable(),
  alternativesText: z.string().nullable(),
  estimatedCostText: z.string().nullable(),
  declarationText: z.string(),
  professionalDisplayName: z.string(),
  professionalLicense: z.string().nullable(),
  expiresAt: z.string().datetime({ offset: true }),
});
export const publicSignatureResultSchema = z.object({
  signedAt: z.string().datetime({ offset: true }),
  signerName: z.string(),
  signatureMethod: consentSignatureMethodSchema,
});
export type ClinicalDocumentMetadata = z.infer<typeof clinicalDocumentMetadataSchema>;
export type ClinicalDocumentType = z.infer<typeof clinicalDocumentTypeSchema>;
export type ClinicalDocumentSourceType = z.infer<typeof clinicalDocumentSourceTypeSchema>;
export type ConsentDetail = z.infer<typeof consentDetailSchema>;
export type PublicConsent = z.infer<typeof publicConsentSchema>;
