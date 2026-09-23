import {
  commercialReportResponseSchema,
  commercialSettingsResponseSchema,
  createLocationRequestSchema,
  createMemberResponseSchema,
  createStaffRequestSchema,
  clinicalReportResponseSchema,
  inventoryReportResponseSchema,
  locationResponseSchema,
  membershipResponseSchema,
  operationalReportResponseSchema,
  paginatedMembershipResponseSchema,
  organizationCurrentResponseSchema,
  updateCommercialSettingsRequestSchema,
  updateLocationRequestSchema,
  updateMembershipRequestSchema,
  updateOrganizationRequestSchema,
  type CommercialReportResponse,
  type CommercialSettingsResponse,
  type ClinicalReportResponse,
  type CreateLocationRequest,
  type CreateMemberResponse,
  type CreateStaffRequest,
  type InventoryReportResponse,
  type LocationResponse,
  type MembershipResponse,
  type OperationalReportResponse,
  type OrganizationCurrentResponse,
  type PaginatedMembershipResponse,
  type UpdateCommercialSettingsRequest,
  type UpdateLocationRequest,
  type UpdateMembershipRequest,
  type UpdateOrganizationRequest,
} from '@veterinary-saas/contracts';
import { apiClient } from '../../services/apiClient';

type MemberQuery = {
  page?: number;
  pageSize?: number;
  role?: string;
  clinicalRole?: string;
  status?: string;
  search?: string;
};

type ReportQuery = {
  from?: string;
  to?: string;
  clinicLocationId?: string;
};

function queryString<TValues extends object>(values: TValues) {
  const query = new URLSearchParams();
  Object.entries(values as Record<string, string | number | undefined>).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

// Optional signals are omitted entirely when absent to respect exact optional request types.
function signalInit(signal?: AbortSignal) {
  return signal ? { signal } : {};
}

function reportPath(path: string, query: ReportQuery, signal?: AbortSignal) {
  return apiClient(path + queryString(query), signalInit(signal));
}

// Admin API methods validate tenant-facing responses and accept abort signals for tenant switches.
export const adminApi = {
  async listMembers(
    query: MemberQuery = {},
    signal?: AbortSignal,
  ): Promise<PaginatedMembershipResponse> {
    return paginatedMembershipResponseSchema.parse(
      await apiClient(`/organization/members${queryString(query)}`, signalInit(signal)),
    );
  },
  async getMember(id: string, signal?: AbortSignal): Promise<MembershipResponse> {
    return membershipResponseSchema.parse(
      await apiClient(`/organization/members/${encodeURIComponent(id)}`, signalInit(signal)),
    );
  },
  async createMember(
    input: CreateStaffRequest,
    signal?: AbortSignal,
  ): Promise<CreateMemberResponse> {
    return createMemberResponseSchema.parse(
      await apiClient('/organization/members', {
        method: 'POST',
        body: createStaffRequestSchema.parse(input),
        ...(signal ? { signal } : {}),
      }),
    );
  },
  async updateMember(
    id: string,
    input: UpdateMembershipRequest,
    signal?: AbortSignal,
  ): Promise<MembershipResponse> {
    return membershipResponseSchema.parse(
      await apiClient(`/organization/members/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: updateMembershipRequestSchema.parse(input),
        ...(signal ? { signal } : {}),
      }),
    );
  },
  async setMemberStatus(
    id: string,
    action: 'suspend' | 'reactivate',
    signal?: AbortSignal,
  ): Promise<MembershipResponse> {
    return membershipResponseSchema.parse(
      await apiClient(`/organization/members/${encodeURIComponent(id)}/${action}`, {
        method: 'POST',
        body: {},
        ...(signal ? { signal } : {}),
      }),
    );
  },
  async currentOrganization(signal?: AbortSignal): Promise<OrganizationCurrentResponse> {
    return organizationCurrentResponseSchema.parse(
      await apiClient('/organization/current', signalInit(signal)),
    );
  },
  // Settings pages use the narrower endpoint reserved for organization administrators.
  async organizationSettings(signal?: AbortSignal): Promise<OrganizationCurrentResponse> {
    return organizationCurrentResponseSchema.parse(
      await apiClient('/organization/settings', signalInit(signal)),
    );
  },
  async updateOrganization(
    input: UpdateOrganizationRequest,
    signal?: AbortSignal,
  ): Promise<OrganizationCurrentResponse> {
    return organizationCurrentResponseSchema.parse(
      await apiClient('/organization/current', {
        method: 'PATCH',
        body: updateOrganizationRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },
  async commercialSettings(signal?: AbortSignal): Promise<CommercialSettingsResponse> {
    return commercialSettingsResponseSchema.parse(
      await apiClient('/organization/commercial-settings', signalInit(signal)),
    );
  },
  async updateCommercialSettings(
    input: UpdateCommercialSettingsRequest,
    signal?: AbortSignal,
  ): Promise<CommercialSettingsResponse> {
    return commercialSettingsResponseSchema.parse(
      await apiClient('/organization/commercial-settings', {
        method: 'PATCH',
        body: updateCommercialSettingsRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },
  async listLocations(signal?: AbortSignal): Promise<LocationResponse[]> {
    return locationResponseSchema
      .array()
      .parse(await apiClient('/organization/locations', signalInit(signal)));
  },
  async createLocation(
    input: CreateLocationRequest,
    signal?: AbortSignal,
  ): Promise<LocationResponse> {
    return locationResponseSchema.parse(
      await apiClient('/organization/locations', {
        method: 'POST',
        body: createLocationRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },
  async updateLocation(
    id: string,
    input: UpdateLocationRequest,
    signal?: AbortSignal,
  ): Promise<LocationResponse> {
    return locationResponseSchema.parse(
      await apiClient(`/organization/locations/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: updateLocationRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },
  async setLocationStatus(
    id: string,
    action: 'activate' | 'deactivate',
    signal?: AbortSignal,
  ): Promise<LocationResponse> {
    return locationResponseSchema.parse(
      await apiClient(`/organization/locations/${encodeURIComponent(id)}/${action}`, {
        method: 'POST',
        body: {},
        ...signalInit(signal),
      }),
    );
  },
  async operationalReport(
    query: ReportQuery,
    signal?: AbortSignal,
  ): Promise<OperationalReportResponse> {
    return operationalReportResponseSchema.parse(
      await reportPath('/reports/operational', query, signal),
    );
  },
  async clinicalReport(query: ReportQuery, signal?: AbortSignal): Promise<ClinicalReportResponse> {
    return clinicalReportResponseSchema.parse(await reportPath('/reports/clinical', query, signal));
  },
  async commercialReport(
    query: ReportQuery,
    signal?: AbortSignal,
  ): Promise<CommercialReportResponse> {
    return commercialReportResponseSchema.parse(
      await reportPath('/reports/commercial', query, signal),
    );
  },
  async inventoryReport(
    query: ReportQuery,
    signal?: AbortSignal,
  ): Promise<InventoryReportResponse> {
    return inventoryReportResponseSchema.parse(
      await reportPath('/reports/inventory', query, signal),
    );
  },
};
