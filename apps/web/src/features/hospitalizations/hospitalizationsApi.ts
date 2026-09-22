import {
  activateHospitalizationRequestSchema,
  createHospitalizationEntryRequestSchema,
  createHospitalizationRequestSchema,
  dischargeHospitalizationRequestSchema,
  hospitalizationDetailResponseSchema,
  hospitalizationEntrySchema,
  hospitalizationEntriesResponseSchema,
  hospitalizationListResponseSchema,
  updateHospitalizationRequestSchema,
  voidHospitalizationRequestSchema,
  type ActivateHospitalizationRequest,
  type CreateHospitalizationEntryRequest,
  type CreateHospitalizationRequest,
  type DischargeHospitalizationRequest,
  type HospitalizationDetail,
  type UpdateHospitalizationRequest,
  type VoidHospitalizationRequest,
} from '@veterinary-saas/contracts';
import { apiClient } from '../../services/apiClient';

function signalInit(signal?: AbortSignal) {
  return signal ? { signal } : {};
}

// Hospitalization routes validate all browser payloads and responses at the API boundary.
export const hospitalizationsApi = {
  async listByPatient(
    patientId: string,
    query: { page: number; pageSize: number; clinicalEncounterId?: string },
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams({
      page: String(query.page),
      pageSize: String(query.pageSize),
    });
    if (query.clinicalEncounterId) params.set('clinicalEncounterId', query.clinicalEncounterId);
    return hospitalizationListResponseSchema.parse(
      await apiClient(`/patients/${patientId}/hospitalizations?${params}`, signalInit(signal)),
    );
  },
  async findById(id: string, signal?: AbortSignal) {
    return hospitalizationDetailResponseSchema.parse(
      await apiClient(`/hospitalizations/${id}`, signalInit(signal)),
    ) as HospitalizationDetail;
  },
  async create(encounterId: string, input: CreateHospitalizationRequest, signal?: AbortSignal) {
    return hospitalizationDetailResponseSchema.parse(
      await apiClient(`/clinical-encounters/${encounterId}/hospitalization`, {
        method: 'POST',
        body: createHospitalizationRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    ) as HospitalizationDetail;
  },
  async update(id: string, input: UpdateHospitalizationRequest, signal?: AbortSignal) {
    return hospitalizationDetailResponseSchema.parse(
      await apiClient(`/hospitalizations/${id}`, {
        method: 'PATCH',
        body: updateHospitalizationRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    ) as HospitalizationDetail;
  },
  async activate(id: string, input: ActivateHospitalizationRequest, signal?: AbortSignal) {
    return hospitalizationDetailResponseSchema.parse(
      await apiClient(`/hospitalizations/${id}/activate`, {
        method: 'POST',
        body: activateHospitalizationRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    ) as HospitalizationDetail;
  },
  async listEntries(id: string, page: number, signal?: AbortSignal) {
    return hospitalizationEntriesResponseSchema.parse(
      await apiClient(
        `/hospitalizations/${id}/entries?page=${page}&pageSize=20`,
        signalInit(signal),
      ),
    );
  },
  async addEntry(id: string, input: CreateHospitalizationEntryRequest, signal?: AbortSignal) {
    return hospitalizationEntrySchema.parse(
      await apiClient(`/hospitalizations/${id}/entries`, {
        method: 'POST',
        body: createHospitalizationEntryRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },
  async discharge(id: string, input: DischargeHospitalizationRequest, signal?: AbortSignal) {
    return hospitalizationDetailResponseSchema.parse(
      await apiClient(`/hospitalizations/${id}/discharge`, {
        method: 'POST',
        body: dischargeHospitalizationRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    ) as HospitalizationDetail;
  },
  async void(id: string, input: VoidHospitalizationRequest, signal?: AbortSignal) {
    return hospitalizationDetailResponseSchema.parse(
      await apiClient(`/hospitalizations/${id}/void`, {
        method: 'POST',
        body: voidHospitalizationRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    ) as HospitalizationDetail;
  },
};
