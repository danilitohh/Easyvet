import {
  dewormingDetailSchema,
  dewormingListQuerySchema,
  dewormingListResponseSchema,
  createDewormingRequestSchema,
  updateDewormingRequestSchema,
  finalizeDewormingRequestSchema,
  voidDewormingRequestSchema,
  type DewormingDetail,
  type DewormingListQuery,
  type DewormingListResponse,
  type CreateDewormingRequest,
  type UpdateDewormingRequest,
  type FinalizeDewormingRequest,
  type VoidDewormingRequest,
} from '@veterinary-saas/contracts';
import { apiClient } from '../../services/apiClient';

type SignalInput = { signal?: AbortSignal };

function signalInit(signal?: AbortSignal): SignalInput {
  return signal ? { signal } : {};
}

function queryString(query: DewormingListQuery): string {
  const parsed = dewormingListQuerySchema.parse(query);
  const params = new URLSearchParams({
    page: String(parsed.page),
    pageSize: String(parsed.pageSize),
  });
  if (parsed.status) params.set('status', parsed.status);
  if (parsed.clinicalEncounterId) params.set('clinicalEncounterId', parsed.clinicalEncounterId);
  if (parsed.from) params.set('from', parsed.from);
  if (parsed.to) params.set('to', parsed.to);
  return `?${params.toString()}`;
}

// Deworming calls are kept separate from vaccinations to preserve the domain boundary in the UI.
export const dewormingsApi = {
  async listByPatient(
    patientId: string,
    query: DewormingListQuery = { page: 1, pageSize: 20 },
    signal?: AbortSignal,
  ): Promise<DewormingListResponse> {
    return dewormingListResponseSchema.parse(
      await apiClient(`/patients/${patientId}/dewormings${queryString(query)}`, signalInit(signal)),
    );
  },

  async findById(dewormingId: string, signal?: AbortSignal): Promise<DewormingDetail> {
    return dewormingDetailSchema.parse(
      await apiClient(`/dewormings/${dewormingId}`, signalInit(signal)),
    );
  },

  async create(
    encounterId: string,
    input: CreateDewormingRequest,
    signal?: AbortSignal,
  ): Promise<DewormingDetail> {
    return dewormingDetailSchema.parse(
      await apiClient(`/clinical-encounters/${encounterId}/dewormings`, {
        method: 'POST',
        body: createDewormingRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },

  async updateDraft(
    dewormingId: string,
    input: UpdateDewormingRequest,
    signal?: AbortSignal,
  ): Promise<DewormingDetail> {
    return dewormingDetailSchema.parse(
      await apiClient(`/dewormings/${dewormingId}`, {
        method: 'PATCH',
        body: updateDewormingRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },

  async finalize(
    dewormingId: string,
    input: FinalizeDewormingRequest,
    signal?: AbortSignal,
  ): Promise<DewormingDetail> {
    return dewormingDetailSchema.parse(
      await apiClient(`/dewormings/${dewormingId}/finalize`, {
        method: 'POST',
        body: finalizeDewormingRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },

  async void(
    dewormingId: string,
    input: VoidDewormingRequest,
    signal?: AbortSignal,
  ): Promise<DewormingDetail> {
    return dewormingDetailSchema.parse(
      await apiClient(`/dewormings/${dewormingId}/void`, {
        method: 'POST',
        body: voidDewormingRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },
};
