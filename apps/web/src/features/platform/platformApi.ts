import {
  platformActivityResponseSchema,
  platformOrganizationDetailResponseSchema,
  platformOrganizationsResponseSchema,
  platformOverviewResponseSchema,
  updatePlatformOrganizationStatusSchema,
  type PlatformActivityResponse,
  type PlatformOrganizationsResponse,
  type PlatformOverviewResponse,
  type UpdatePlatformOrganizationStatus,
} from '@veterinary-saas/contracts';
import { apiClient } from '../../services/apiClient';

export const platformApi = {
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
};
