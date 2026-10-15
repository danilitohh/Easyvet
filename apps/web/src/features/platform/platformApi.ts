import {
  assignPlatformSubscriptionResponseSchema,
  assignPlatformSubscriptionSchema,
  createPlatformAdminAccountResponseSchema,
  createPlatformAdminAccountSchema,
  platformActivityResponseSchema,
  platformAdminAccountSchema,
  platformAdminAccountsResponseSchema,
  platformOrganizationDetailResponseSchema,
  platformOrganizationsResponseSchema,
  platformOverviewResponseSchema,
  platformSubscriptionPlansResponseSchema,
  platformSubscriptionsResponseSchema,
  updatePlatformOrganizationStatusSchema,
  updatePlatformAdminAccountStatusSchema,
  type PlatformActivityResponse,
  type PlatformOrganizationsResponse,
  type PlatformOverviewResponse,
  type AssignPlatformSubscription,
  type CreatePlatformAdminAccount,
  type PlatformSubscriptionsResponse,
  type UpdatePlatformOrganizationStatus,
  type UpdatePlatformAdminAccountStatus,
} from '@veterinary-saas/contracts';
import { apiClient } from '../../services/apiClient';

export const platformApi = {
  async platformAccounts(params: { search?: string } = {}, signal?: AbortSignal) {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set('search', params.search.trim());
    const suffix = query.size ? `?${query.toString()}` : '';
    return platformAdminAccountsResponseSchema.parse(
      await apiClient(`/platform/accounts${suffix}`, signal ? { signal } : {}),
    );
  },
  async createPlatformAccount(input: CreatePlatformAdminAccount) {
    const body = createPlatformAdminAccountSchema.parse(input);
    return createPlatformAdminAccountResponseSchema.parse(
      await apiClient('/platform/accounts', { method: 'POST', body }),
    );
  },
  async updatePlatformAccountStatus(userId: string, input: UpdatePlatformAdminAccountStatus) {
    const body = updatePlatformAdminAccountStatusSchema.parse(input);
    return platformAdminAccountSchema.parse(
      await apiClient(`/platform/accounts/${userId}/status`, { method: 'PATCH', body }),
    );
  },
  async overview(signal?: AbortSignal): Promise<PlatformOverviewResponse> {
    return platformOverviewResponseSchema.parse(
      await apiClient('/platform/overview', signal ? { signal } : {}),
    );
  },
  async organizations(
    params: { search?: string; status?: string } = {},
    signal?: AbortSignal,
  ): Promise<PlatformOrganizationsResponse> {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.status && params.status !== 'ALL') query.set('status', params.status);
    const suffix = query.size ? `?${query.toString()}` : '';
    return platformOrganizationsResponseSchema.parse(
      await apiClient(`/platform/organizations${suffix}`, signal ? { signal } : {}),
    );
  },
  async organizationDetail(organizationId: string, signal?: AbortSignal) {
    return platformOrganizationDetailResponseSchema.parse(
      await apiClient(`/platform/organizations/${organizationId}`, signal ? { signal } : {}),
    );
  },
  async updateOrganizationStatus(organizationId: string, input: UpdatePlatformOrganizationStatus) {
    const body = updatePlatformOrganizationStatusSchema.parse(input);
    return apiClient(`/platform/organizations/${organizationId}/status`, {
      method: 'PATCH',
      body,
    });
  },
  async activity(signal?: AbortSignal): Promise<PlatformActivityResponse> {
    return platformActivityResponseSchema.parse(
      await apiClient('/platform/activity', signal ? { signal } : {}),
    );
  },
  async subscriptionPlans(signal?: AbortSignal) {
    return platformSubscriptionPlansResponseSchema.parse(
      await apiClient('/platform/subscription-plans', signal ? { signal } : {}),
    );
  },
  async subscriptions(
    params: { search?: string } = {},
    signal?: AbortSignal,
  ): Promise<PlatformSubscriptionsResponse> {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set('search', params.search.trim());
    const suffix = query.size ? `?${query.toString()}` : '';
    return platformSubscriptionsResponseSchema.parse(
      await apiClient(`/platform/subscriptions${suffix}`, signal ? { signal } : {}),
    );
  },
  async assignSubscription(organizationId: string, input: AssignPlatformSubscription) {
    const body = assignPlatformSubscriptionSchema.parse(input);
    return assignPlatformSubscriptionResponseSchema.parse(
      await apiClient(`/platform/organizations/${organizationId}/subscription`, {
        method: 'PUT',
        body,
      }),
    );
  },
};
