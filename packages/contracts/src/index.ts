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
});

export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;
export type ActiveMembership = z.infer<typeof activeMembershipSchema>;

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
