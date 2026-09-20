import {
  appointmentListResponseSchema,
  appointmentResponseSchema,
  locationResponseSchema,
  membershipResponseSchema,
  organizationCurrentResponseSchema,
  patientsListResponseSchema,
  type AppointmentListQuery,
  type AppointmentListResponse,
  type AppointmentResponse,
  type LocationResponse,
  type MembershipResponse,
  type OrganizationCurrentResponse,
  type PatientsListResponse,
} from '@veterinary-saas/contracts';
import { apiClient } from '../../services/apiClient';

export type AgendaListParams = AppointmentListQuery & {
  signal?: AbortSignal;
};

export type AgendaPatientParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  signal?: AbortSignal;
};

function queryString(values: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

function signalInit(signal?: AbortSignal): { signal: AbortSignal } | Record<string, never> {
  return signal ? { signal } : {};
}

// Agenda API methods keep URL construction, credentials and contract parsing outside UI code.
export const agendaApi = {
  async listAppointments({
    signal,
    ...params
  }: AgendaListParams): Promise<AppointmentListResponse> {
    return appointmentListResponseSchema.parse(
      await apiClient(
        `/appointments${queryString(params as Record<string, string | undefined>)}`,
        signalInit(signal),
      ),
    );
  },

  async findAppointment(appointmentId: string, signal?: AbortSignal): Promise<AppointmentResponse> {
    return appointmentResponseSchema.parse(
      await apiClient(`/appointments/${appointmentId}`, signalInit(signal)),
    );
  },

  async currentOrganization(signal?: AbortSignal): Promise<OrganizationCurrentResponse> {
    return organizationCurrentResponseSchema.parse(
      await apiClient('/organization/current', signalInit(signal)),
    );
  },

  async listLocations(signal?: AbortSignal): Promise<LocationResponse[]> {
    const response = await apiClient('/organization/locations', signalInit(signal));
    return locationResponseSchema.array().parse(response);
  },

  async listMemberships(signal?: AbortSignal): Promise<MembershipResponse[]> {
    const response = await apiClient('/organization/memberships', signalInit(signal));
    return membershipResponseSchema.array().parse(response);
  },

  async listPatients({
    signal,
    ...params
  }: AgendaPatientParams = {}): Promise<PatientsListResponse> {
    const response = await apiClient(
      `/patients${queryString({
        page: String(params.page ?? 1),
        pageSize: String(params.pageSize ?? 20),
        search: params.search?.trim() || undefined,
        status: 'ACTIVE',
        sortBy: 'name',
        sortDirection: 'asc',
      })}`,
      signalInit(signal),
    );
    return patientsListResponseSchema.parse(response);
  },
};
