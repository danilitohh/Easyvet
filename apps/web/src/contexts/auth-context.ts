import { createContext } from 'react';
import type {
  ActiveMembership,
  AuthMeResponse,
  AuthenticatedUser,
  ChangePasswordRequest,
  LoginRequest,
} from '@veterinary-saas/contracts';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
export type AuthState = {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  activeMembership: ActiveMembership | null;
  memberships: ActiveMembership[];
  organizationSelectionRequired: boolean;
};

export type AuthContextValue = AuthState & {
  login: (input: LoginRequest) => Promise<AuthMeResponse>;
  switchOrganization: (membershipId: string) => Promise<AuthMeResponse>;
  changePassword: (input: ChangePasswordRequest) => Promise<AuthMeResponse>;
  logout: () => Promise<void>;
};

const demoUser: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'demo@easyvet.local',
  platformRole: 'PLATFORM_ADMIN',
  mustChangePassword: false,
};

// Default context keeps the visual shell usable in isolated component tests and mock mode.
export const defaultContext: AuthContextValue = {
  status: 'authenticated',
  user: demoUser,
  activeMembership: null,
  memberships: [],
  organizationSelectionRequired: false,
  login: async () => ({
    user: demoUser,
    activeMembership: null,
    memberships: [],
    organizationSelectionRequired: false,
  }),
  switchOrganization: async () => ({
    user: demoUser,
    activeMembership: null,
    memberships: [],
    organizationSelectionRequired: false,
  }),
  changePassword: async () => ({
    user: demoUser,
    activeMembership: null,
    memberships: [],
    organizationSelectionRequired: false,
  }),
  logout: async () => undefined,
};

// The context is isolated from the provider so React Fast Refresh can preserve components cleanly.
export const AuthContext = createContext<AuthContextValue>(defaultContext);
