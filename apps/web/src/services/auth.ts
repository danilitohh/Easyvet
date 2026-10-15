import {
  authMeResponseSchema,
  changePasswordRequestSchema,
  emailActionRequestSchema,
  emailVerificationSchema,
  loginResponseSchema,
  logoutResponseSchema,
  platformAdminBootstrapRequestSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  publicActionResponseSchema,
  registrationRequestSchema,
  type AuthMeResponse,
  type ChangePasswordRequest,
  type PasswordResetConfirm,
  type PasswordResetRequest,
  type LoginRequest,
  type LoginResponse,
  type PlatformAdminBootstrapRequest,
  type RegistrationRequest,
  type SwitchOrganizationRequest,
} from '@veterinary-saas/contracts';
import { apiClient } from './apiClient';

// Auth API methods parse every response through the shared contracts package.
export const authApi = {
  async bootstrapPlatformAdmin(input: PlatformAdminBootstrapRequest): Promise<{ success: true }> {
    const validated = platformAdminBootstrapRequestSchema.parse(input);
    return publicActionResponseSchema.parse(
      await apiClient('/auth/platform-admin/bootstrap', { method: 'POST', body: validated }),
    );
  },
  async register(input: RegistrationRequest): Promise<{ success: true }> {
    const validated = registrationRequestSchema.parse(input);
    return publicActionResponseSchema.parse(
      await apiClient('/auth/register', { method: 'POST', body: validated }),
    );
  },
  async verifyEmail(token: string): Promise<{ success: true }> {
    const validated = emailVerificationSchema.parse({ token });
    return publicActionResponseSchema.parse(
      await apiClient('/auth/verify-email', { method: 'POST', body: validated }),
    );
  },
  async resendVerification(email: string): Promise<{ success: true }> {
    const validated = emailActionRequestSchema.parse({ email });
    return publicActionResponseSchema.parse(
      await apiClient('/auth/verification/resend', { method: 'POST', body: validated }),
    );
  },
  async requestPasswordReset(input: PasswordResetRequest): Promise<{ success: true }> {
    const validated = passwordResetRequestSchema.parse(input);
    return publicActionResponseSchema.parse(
      await apiClient('/auth/password-reset/request', { method: 'POST', body: validated }),
    );
  },
  async confirmPasswordReset(input: PasswordResetConfirm): Promise<{ success: true }> {
    const validated = passwordResetConfirmSchema.parse(input);
    return publicActionResponseSchema.parse(
      await apiClient('/auth/password-reset/confirm', { method: 'POST', body: validated }),
    );
  },
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
