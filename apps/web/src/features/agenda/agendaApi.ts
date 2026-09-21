import {
  appointmentListResponseSchema,
  appointmentResponseSchema,
  availableSlotsResponseSchema,
  availabilityRuleRequestSchema,
  availabilityRuleResponseSchema,
  cancelAppointmentRequestSchema,
  createAppointmentRequestSchema,
  locationResponseSchema,
  membershipResponseSchema,
  organizationCurrentResponseSchema,
  patientsListResponseSchema,
  rescheduleAppointmentRequestSchema,
  updateAppointmentRequestSchema,
  type AvailableSlotsResponse,
  type AvailabilityRuleRequest,
  type AvailabilityRuleResponse,
  type CancelAppointmentRequest,
  type CreateAppointmentRequest,
  type AppointmentListQuery,
  type AppointmentListResponse,
  type AppointmentResponse,
  type LocationResponse,
  type MembershipResponse,
  type OrganizationCurrentResponse,
  type PatientsListResponse,
  type RescheduleAppointmentRequest,
  type UpdateAppointmentRequest,
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

export type AvailableSlotsParams = {
  date: string;
  clinicLocationId: string;
  assignedMembershipId?: string;
  durationMinutes: number;
  signal?: AbortSignal;
};

export type AvailabilityRuleInput = AvailabilityRuleRequest;

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

  async createAppointment(input: CreateAppointmentRequest): Promise<AppointmentResponse> {
    return appointmentResponseSchema.parse(
      await apiClient('/appointments', {
        method: 'POST',
        body: createAppointmentRequestSchema.parse(input),
      }),
    );
  },

  async updateAppointment(
    appointmentId: string,
    input: UpdateAppointmentRequest,
  ): Promise<AppointmentResponse> {
    return appointmentResponseSchema.parse(
      await apiClient(`/appointments/${appointmentId}`, {
        method: 'PATCH',
        body: updateAppointmentRequestSchema.parse(input),
      }),
    );
  },

  async rescheduleAppointment(
    appointmentId: string,
    input: RescheduleAppointmentRequest,
  ): Promise<AppointmentResponse> {
    return appointmentResponseSchema.parse(
      await apiClient(`/appointments/${appointmentId}/reschedule`, {
        method: 'POST',
        body: rescheduleAppointmentRequestSchema.parse(input),
      }),
    );
  },

  async cancelAppointment(
    appointmentId: string,
    input: CancelAppointmentRequest,
  ): Promise<AppointmentResponse> {
    return appointmentResponseSchema.parse(
      await apiClient(`/appointments/${appointmentId}/cancel`, {
        method: 'POST',
        body: cancelAppointmentRequestSchema.parse(input),
      }),
    );
  },

  // Lifecycle operations use explicit backend endpoints so the state machine remains authoritative.
  async checkInAppointment(appointmentId: string): Promise<AppointmentResponse> {
    return appointmentResponseSchema.parse(
      await apiClient(`/appointments/${appointmentId}/check-in`, { method: 'POST' }),
    );
  },

  async startAppointment(appointmentId: string): Promise<AppointmentResponse> {
    return appointmentResponseSchema.parse(
      await apiClient(`/appointments/${appointmentId}/start`, { method: 'POST' }),
    );
  },

  async completeAppointment(appointmentId: string): Promise<AppointmentResponse> {
    return appointmentResponseSchema.parse(
      await apiClient(`/appointments/${appointmentId}/complete`, { method: 'POST' }),
    );
  },

  async markNoShow(appointmentId: string): Promise<AppointmentResponse> {
    return appointmentResponseSchema.parse(
      await apiClient(`/appointments/${appointmentId}/no-show`, { method: 'POST' }),
    );
  },

  async confirmByClinic(appointmentId: string): Promise<AppointmentResponse> {
    return appointmentResponseSchema.parse(
      await apiClient(`/appointments/${appointmentId}/confirm-by-clinic`, { method: 'POST' }),
    );
  },

  // Availability rules are civil recurring schedules and never receive tenant fields from the UI.
  async listAvailability(signal?: AbortSignal): Promise<AvailabilityRuleResponse[]> {
    return availabilityRuleResponseSchema
      .array()
      .parse(await apiClient('/availability-rules', signalInit(signal)));
  },

  async createAvailability(input: AvailabilityRuleInput): Promise<AvailabilityRuleResponse> {
    return availabilityRuleResponseSchema.parse(
      await apiClient('/availability-rules', {
        method: 'POST',
        body: availabilityRuleRequestSchema.parse(input),
      }),
    );
  },

  async updateAvailability(
    ruleId: string,
    input: Partial<AvailabilityRuleInput> & { isActive?: boolean },
  ): Promise<AvailabilityRuleResponse> {
    return availabilityRuleResponseSchema.parse(
      await apiClient(`/availability-rules/${ruleId}`, {
        method: 'PATCH',
        body: input,
      }),
    );
  },

  async deactivateAvailability(ruleId: string): Promise<AvailabilityRuleResponse> {
    return availabilityRuleResponseSchema.parse(
      await apiClient(`/availability-rules/${ruleId}`, { method: 'DELETE' }),
    );
  },

  async availableSlots({
    signal,
    ...params
  }: AvailableSlotsParams): Promise<AvailableSlotsResponse> {
    return availableSlotsResponseSchema.parse(
      await apiClient(
        `/agenda/available-slots${queryString({
          date: params.date,
          clinicLocationId: params.clinicLocationId,
          assignedMembershipId: params.assignedMembershipId,
          durationMinutes: String(params.durationMinutes),
        })}`,
        signalInit(signal),
      ),
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
