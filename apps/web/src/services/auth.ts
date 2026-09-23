import {
  authMeResponseSchema,
  changePasswordRequestSchema,
  loginResponseSchema,
  logoutResponseSchema,
  type AuthMeResponse,
  type ChangePasswordRequest,
  type LoginRequest,
  type LoginResponse,
  type SwitchOrganizationRequest,
} from '@veterinary-saas/contracts';
import { apiClient } from './apiClient';

// Auth API methods parse every response through the shared contracts package.
export const authApi = {
  async login(input: LoginRequest): Promise<LoginResponse> {
    return loginResponseSchema.parse(
      await apiClient('/auth/login', { method: 'POST', body: input }),
    );
  },
  async me(): Promise<AuthMeResponse> {
    return authMeResponseSchema.parse(await apiClient('/auth/me'));
  },
  async switchOrganization(input: SwitchOrganizationRequest): Promise<AuthMeResponse> {
    return authMeResponseSchema.parse(
      await apiClient('/auth/switch-organization', { method: 'POST', body: input }),
    );
  },
  async changePassword(input: ChangePasswordRequest): Promise<{ success: true }> {
    const validated = changePasswordRequestSchema.parse(input);
    return (await apiClient('/auth/change-password', {
      method: 'POST',
      body: validated,
    })) as { success: true };
  },
  async logout() {
    return logoutResponseSchema.parse(
      await apiClient('/auth/logout', { method: 'POST', body: {} }),
    );
  },
};
