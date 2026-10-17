import {
  appointmentListResponseSchema,
  createGroomingVisitRequestSchema,
  groomingGroomerListQuerySchema,
  groomingGroomerListResponseSchema,
  groomingVisitListQuerySchema,
  groomingVisitListResponseSchema,
  groomingVisitSchema,
  startGroomingVisitRequestSchema,
  completeGroomingVisitRequestSchema,
  updateGroomingVisitRequestSchema,
  voidGroomingVisitRequestSchema,
  type AppointmentListResponse,
  type CreateGroomingVisitRequest,
  type GroomingGroomerListQuery,
  type GroomingGroomerListResponse,
  type GroomingVisit,
  type GroomingVisitListQuery,
  type GroomingVisitListResponse,
  type UpdateGroomingVisitRequest,
} from '@veterinary-saas/contracts';
import { apiClient } from '../../services/apiClient';
import { agendaApi } from '../agenda/agendaApi';

// The active queue uses shared Zod contracts for every URL and JSON boundary.
function queryString(input: GroomingVisitListQuery): string {
  const query = new URLSearchParams();
  Object.entries(groomingVisitListQuerySchema.parse(input)).forEach(([key, value]) => {
    if (value !== undefined) query.set(key, String(value));
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

function signalInit(signal?: AbortSignal): { signal: AbortSignal } | Record<string, never> {
  return signal ? { signal } : {};
}

export const groomingApi = {
  async list(
    input: GroomingVisitListQuery,
    signal?: AbortSignal,
  ): Promise<GroomingVisitListResponse> {
    return groomingVisitListResponseSchema.parse(
      await apiClient(`/grooming-visits${queryString(input)}`, signalInit(signal)),
    );
  },

  async listByPatient(
    patientId: string,
    input: GroomingVisitListQuery,
    signal?: AbortSignal,
  ): Promise<GroomingVisitListResponse> {
    return groomingVisitListResponseSchema.parse(
      await apiClient(
        `/patients/${patientId}/grooming-visits${queryString(input)}`,
        signalInit(signal),
      ),
    );
  },

  async findById(id: string, signal?: AbortSignal): Promise<GroomingVisit> {
    return groomingVisitSchema.parse(await apiClient(`/grooming-visits/${id}`, signalInit(signal)));
  },

  async groomers(
    input: GroomingGroomerListQuery = { page: 1, pageSize: 20 },
    signal?: AbortSignal,
  ): Promise<GroomingGroomerListResponse> {
    const parsed = groomingGroomerListQuerySchema.parse(input);
    const query = new URLSearchParams({
      page: String(parsed.page),
      pageSize: String(parsed.pageSize),
      ...(parsed.search ? { search: parsed.search } : {}),
    });
    return groomingGroomerListResponseSchema.parse(
      await apiClient(`/grooming/groomers?${query.toString()}`, signalInit(signal)),
    );
  },

  async create(
    patientId: string,
    input: CreateGroomingVisitRequest,
    signal?: AbortSignal,
  ): Promise<GroomingVisit> {
    return groomingVisitSchema.parse(
      await apiClient(`/patients/${patientId}/grooming-visits`, {
        method: 'POST',
        body: createGroomingVisitRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },

  async update(
    id: string,
    input: UpdateGroomingVisitRequest,
    signal?: AbortSignal,
  ): Promise<GroomingVisit> {
    return groomingVisitSchema.parse(
      await apiClient(`/grooming-visits/${id}`, {
        method: 'PATCH',
        body: updateGroomingVisitRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },

  async start(id: string, expectedVersion: number, signal?: AbortSignal): Promise<GroomingVisit> {
    return groomingVisitSchema.parse(
      await apiClient(`/grooming-visits/${id}/start`, {
        method: 'POST',
        body: startGroomingVisitRequestSchema.parse({ expectedVersion }),
        ...signalInit(signal),
      }),
    );
  },

  async complete(
    id: string,
    input: {
      expectedVersion: number;
      postServiceNotes?: string | null;
      incidentNotes?: string | null;
    },
    signal?: AbortSignal,
  ): Promise<GroomingVisit> {
    return groomingVisitSchema.parse(
      await apiClient(`/grooming-visits/${id}/complete`, {
        method: 'POST',
        body: completeGroomingVisitRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },

  async void(
    id: string,
    input: { expectedVersion: number; reason: string },
    signal?: AbortSignal,
  ): Promise<GroomingVisit> {
    return groomingVisitSchema.parse(
      await apiClient(`/grooming-visits/${id}/void`, {
        method: 'POST',
        body: voidGroomingVisitRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },

  // Appointment options remain linked to the selected Patient; the UI narrows by ClinicLocation.
  async appointmentsForPatient(
    patientId: string,
    currentAppointmentId?: string | null,
    signal?: AbortSignal,
  ): Promise<AppointmentListResponse> {
    const from = new Date();
    const to = new Date(from.getTime() + 89 * 24 * 60 * 60 * 1000);
    const upcoming = await agendaApi.listAppointments({
      from: from.toISOString(),
      to: to.toISOString(),
      patientId,
      ...(signal ? { signal } : {}),
    });
    if (!currentAppointmentId || upcoming.data.some(({ id }) => id === currentAppointmentId))
      return upcoming;

    // Preserve an older or cancelled linked appointment so a draft can explicitly unlink it.
    const current = await agendaApi.findAppointment(currentAppointmentId, signal);
    return appointmentListResponseSchema.parse({
      data: [...upcoming.data, current],
      pagination: {
        ...upcoming.pagination,
        total: upcoming.pagination.total + 1,
        totalPages: Math.max(
          1,
          Math.ceil((upcoming.pagination.total + 1) / upcoming.pagination.pageSize),
        ),
      },
    });
  },
};
