import {
  anesthesiaObservationListQuerySchema,
  anesthesiaObservationListResponseSchema,
  anesthesiaObservationMutationResponseSchema,
  anesthesiaRecordDetailSchema,
  anesthesiaRecordListQuerySchema,
  anesthesiaRecordListResponseSchema,
  createAnesthesiaObservationRequestSchema,
  createAnesthesiaRecordRequestSchema,
  finalizeAnesthesiaRecordRequestSchema,
  updateAnesthesiaObservationRequestSchema,
  updateAnesthesiaRecordRequestSchema,
  voidAnesthesiaRecordRequestSchema,
  type AnesthesiaObservationListQuery,
  type AnesthesiaRecordListQuery,
  type CreateAnesthesiaObservationRequest,
  type CreateAnesthesiaRecordRequest,
  type RemoveAnesthesiaObservationRequest,
  type UpdateAnesthesiaObservationRequest,
  type UpdateAnesthesiaRecordRequest,
  type VoidAnesthesiaRecordRequest,
} from '@veterinary-saas/contracts';
import { apiClient } from '../../services/apiClient';

function signalInit(signal?: AbortSignal) {
  return signal ? { signal } : {};
}
function recordQueryString(query: AnesthesiaRecordListQuery): string {
  const parsed = anesthesiaRecordListQuerySchema.parse(query);
  const params = new URLSearchParams({
    page: String(parsed.page),
    pageSize: String(parsed.pageSize),
  });
  for (const key of [
    'status',
    'clinicalEncounterId',
    'clinicalProcedureId',
    'from',
    'to',
  ] as const) {
    const value = parsed[key];
    if (value) params.set(key, value);
  }
  return `?${params.toString()}`;
}
function observationQueryString(query: AnesthesiaObservationListQuery): string {
  const parsed = anesthesiaObservationListQuerySchema.parse(query);
  return `?${new URLSearchParams({ page: String(parsed.page), pageSize: String(parsed.pageSize) })}`;
}

// Anesthesia and monitoring share aggregate versions, so each mutation returns its new parent version.
export const anesthesiaApi = {
  async listByPatient(patientId: string, query: AnesthesiaRecordListQuery, signal?: AbortSignal) {
    return anesthesiaRecordListResponseSchema.parse(
      await apiClient(
        `/patients/${patientId}/anesthesia-records${recordQueryString(query)}`,
        signalInit(signal),
      ),
    );
  },
  async findById(recordId: string, signal?: AbortSignal) {
    return anesthesiaRecordDetailSchema.parse(
      await apiClient(`/anesthesia-records/${recordId}`, signalInit(signal)),
    );
  },
  async listObservations(
    recordId: string,
    query: AnesthesiaObservationListQuery,
    signal?: AbortSignal,
  ) {
    return anesthesiaObservationListResponseSchema.parse(
      await apiClient(
        `/anesthesia-records/${recordId}/observations${observationQueryString(query)}`,
        signalInit(signal),
      ),
    );
  },
  async create(encounterId: string, input: CreateAnesthesiaRecordRequest, signal?: AbortSignal) {
    return anesthesiaRecordDetailSchema.parse(
      await apiClient(`/clinical-encounters/${encounterId}/anesthesia-records`, {
        method: 'POST',
        body: createAnesthesiaRecordRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },
  async updateDraft(recordId: string, input: UpdateAnesthesiaRecordRequest, signal?: AbortSignal) {
    return anesthesiaRecordDetailSchema.parse(
      await apiClient(`/anesthesia-records/${recordId}`, {
        method: 'PATCH',
        body: updateAnesthesiaRecordRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },
  async finalize(recordId: string, expectedVersion: number, signal?: AbortSignal) {
    return anesthesiaRecordDetailSchema.parse(
      await apiClient(`/anesthesia-records/${recordId}/finalize`, {
        method: 'POST',
        body: finalizeAnesthesiaRecordRequestSchema.parse({ expectedVersion }),
        ...signalInit(signal),
      }),
    );
  },
  async void(recordId: string, input: VoidAnesthesiaRecordRequest, signal?: AbortSignal) {
    return anesthesiaRecordDetailSchema.parse(
      await apiClient(`/anesthesia-records/${recordId}/void`, {
        method: 'POST',
        body: voidAnesthesiaRecordRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },
  async createObservation(
    recordId: string,
    input: CreateAnesthesiaObservationRequest,
    signal?: AbortSignal,
  ) {
    return anesthesiaObservationMutationResponseSchema.parse(
      await apiClient(`/anesthesia-records/${recordId}/observations`, {
        method: 'POST',
        body: createAnesthesiaObservationRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },
  async updateObservation(
    recordId: string,
    observationId: string,
    input: UpdateAnesthesiaObservationRequest,
    signal?: AbortSignal,
  ) {
    return anesthesiaObservationMutationResponseSchema.parse(
      await apiClient(`/anesthesia-records/${recordId}/observations/${observationId}`, {
        method: 'PATCH',
        body: updateAnesthesiaObservationRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },
  async removeObservation(
    recordId: string,
    observationId: string,
    input: RemoveAnesthesiaObservationRequest,
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams({ expectedVersion: String(input.expectedVersion) });
    return anesthesiaObservationMutationResponseSchema.parse(
      await apiClient(`/anesthesia-records/${recordId}/observations/${observationId}?${params}`, {
        method: 'DELETE',
        ...signalInit(signal),
      }),
    );
  },
};
