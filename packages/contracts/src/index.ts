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
