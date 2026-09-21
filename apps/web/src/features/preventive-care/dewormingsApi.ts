import {
  dewormingDetailSchema,
  dewormingListQuerySchema,
  dewormingListResponseSchema,
  type DewormingDetail,
  type DewormingListQuery,
  type DewormingListResponse,
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
};
