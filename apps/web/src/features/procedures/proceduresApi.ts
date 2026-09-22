import {
  clinicalProcedureDetailSchema,
  clinicalProcedureListQuerySchema,
  clinicalProcedureListResponseSchema,
  createClinicalProcedureRequestSchema,
  finalizeClinicalProcedureRequestSchema,
  updateClinicalProcedureRequestSchema,
  voidClinicalProcedureRequestSchema,
  type ClinicalProcedureDetail,
  type ClinicalProcedureListQuery,
  type ClinicalProcedureListResponse,
  type CreateClinicalProcedureRequest,
  type FinalizeClinicalProcedureRequest,
  type UpdateClinicalProcedureRequest,
  type VoidClinicalProcedureRequest,
} from '@veterinary-saas/contracts';
import { apiClient } from '../../services/apiClient';

function signalInit(signal?: AbortSignal) {
  return signal ? { signal } : {};
}

function queryString(query: ClinicalProcedureListQuery): string {
  const parsed = clinicalProcedureListQuerySchema.parse(query);
  const params = new URLSearchParams({
    page: String(parsed.page),
    pageSize: String(parsed.pageSize),
  });
  for (const key of ['status', 'kind', 'clinicalEncounterId', 'from', 'to'] as const) {
    const value = parsed[key];
    if (value) params.set(key, value);
  }
  return `?${params.toString()}`;
}

// Procedure endpoints are typed at the browser boundary; surgery details remain nested in the aggregate.
export const proceduresApi = {
  async listByPatient(patientId: string, query: ClinicalProcedureListQuery, signal?: AbortSignal) {
    return clinicalProcedureListResponseSchema.parse(
      await apiClient(`/patients/${patientId}/procedures${queryString(query)}`, signalInit(signal)),
    ) as ClinicalProcedureListResponse;
  },
  async findById(procedureId: string, signal?: AbortSignal) {
    return clinicalProcedureDetailSchema.parse(
      await apiClient(`/procedures/${procedureId}`, signalInit(signal)),
    ) as ClinicalProcedureDetail;
  },
  async create(encounterId: string, input: CreateClinicalProcedureRequest, signal?: AbortSignal) {
    return clinicalProcedureDetailSchema.parse(
      await apiClient(`/clinical-encounters/${encounterId}/procedures`, {
        method: 'POST',
        body: createClinicalProcedureRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    ) as ClinicalProcedureDetail;
  },
  async updateDraft(
    procedureId: string,
    input: UpdateClinicalProcedureRequest,
    signal?: AbortSignal,
  ) {
    return clinicalProcedureDetailSchema.parse(
      await apiClient(`/procedures/${procedureId}`, {
        method: 'PATCH',
        body: updateClinicalProcedureRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    ) as ClinicalProcedureDetail;
  },
  async finalize(
    procedureId: string,
    input: FinalizeClinicalProcedureRequest,
    signal?: AbortSignal,
  ) {
    return clinicalProcedureDetailSchema.parse(
      await apiClient(`/procedures/${procedureId}/finalize`, {
        method: 'POST',
        body: finalizeClinicalProcedureRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    ) as ClinicalProcedureDetail;
  },
  async void(procedureId: string, input: VoidClinicalProcedureRequest, signal?: AbortSignal) {
    return clinicalProcedureDetailSchema.parse(
      await apiClient(`/procedures/${procedureId}/void`, {
        method: 'POST',
        body: voidClinicalProcedureRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    ) as ClinicalProcedureDetail;
  },
};
