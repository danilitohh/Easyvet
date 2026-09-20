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
]);

const authenticatedUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  platformRole: platformRoleSchema,
});

const activeMembershipSchema = z.object({
  id: z.string().uuid(),
  role: membershipRoleSchema,
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
  status: membershipStatusSchema,
});

export type OrganizationCurrentResponse = z.infer<typeof organizationCurrentResponseSchema>;
export type UpdateOrganizationRequest = z.infer<typeof updateOrganizationRequestSchema>;
export type LocationResponse = z.infer<typeof locationResponseSchema>;
export type MembershipResponse = z.infer<typeof membershipResponseSchema>;

const ownerStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);
const patientStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);
const patientSexSchema = z.enum(['MALE', 'FEMALE', 'UNKNOWN']);
const pageSchema = z.number().int().min(1);
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
    birthDate: z.string().date().nullable().optional(),
    birthDateEstimated: z.boolean().optional(),
    color: optionalText(80),
    microchipNumber: optionalText(80),
    currentWeightKg: z.number().positive().max(1000).nullable().optional(),
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
