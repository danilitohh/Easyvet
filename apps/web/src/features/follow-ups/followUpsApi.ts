import {
  clinicalFollowUpDashboardSchema,
  clinicalFollowUpDetailSchema,
  clinicalFollowUpListQuerySchema,
  clinicalFollowUpListResponseSchema,
  createClinicalFollowUpRequestSchema,
  updateClinicalFollowUpRequestSchema,
  completeClinicalFollowUpRequestSchema,
  voidClinicalFollowUpRequestSchema,
  type ClinicalFollowUpDashboard,
  type ClinicalFollowUpDetail,
  type ClinicalFollowUpListQuery,
  type ClinicalFollowUpListResponse,
  type CreateClinicalFollowUpRequest,
  type UpdateClinicalFollowUpRequest,
  type CompleteClinicalFollowUpRequest,
  type VoidClinicalFollowUpRequest,
} from '@veterinary-saas/contracts';
import { apiClient } from '../../services/apiClient';

// Query parameters are serialized after shared-schema validation to keep the API boundary strict.
function queryString(input: ClinicalFollowUpListQuery): string {
  const query = new URLSearchParams();
  Object.entries(clinicalFollowUpListQuerySchema.parse(input)).forEach(([key, value]) => {
    if (value !== undefined) query.set(key, String(value));
  });
  return `?${query.toString()}`;
}

// Follow-up API methods validate both request and response payloads at the browser boundary.
export const followUpsApi = {
  async list(
    input: ClinicalFollowUpListQuery,
    signal?: AbortSignal,
  ): Promise<ClinicalFollowUpListResponse> {
    return clinicalFollowUpListResponseSchema.parse(
      await apiClient(`/follow-ups${queryString(input)}`, signal ? { signal } : {}),
    );
  },

  async listByPatient(
    patientId: string,
    input: ClinicalFollowUpListQuery,
    signal?: AbortSignal,
  ): Promise<ClinicalFollowUpListResponse> {
    return clinicalFollowUpListResponseSchema.parse(
      await apiClient(
        `/patients/${patientId}/follow-ups${queryString(input)}`,
        signal ? { signal } : {},
      ),
    );
  },

  async dashboard(signal?: AbortSignal): Promise<ClinicalFollowUpDashboard> {
    return clinicalFollowUpDashboardSchema.parse(
      await apiClient('/follow-ups/dashboard', signal ? { signal } : {}),
    );
  },

  async findById(id: string, signal?: AbortSignal): Promise<ClinicalFollowUpDetail> {
    return clinicalFollowUpDetailSchema.parse(
      await apiClient(`/follow-ups/${id}`, signal ? { signal } : {}),
    );
  },

  async create(
    patientId: string,
    input: CreateClinicalFollowUpRequest,
    signal?: AbortSignal,
  ): Promise<ClinicalFollowUpDetail> {
    return clinicalFollowUpDetailSchema.parse(
      await apiClient(`/patients/${patientId}/follow-ups`, {
        method: 'POST',
        body: createClinicalFollowUpRequestSchema.parse(input),
        ...(signal ? { signal } : {}),
      }),
    );
  },

  async update(
    id: string,
    input: UpdateClinicalFollowUpRequest,
    signal?: AbortSignal,
  ): Promise<ClinicalFollowUpDetail> {
    return clinicalFollowUpDetailSchema.parse(
      await apiClient(`/follow-ups/${id}`, {
        method: 'PATCH',
        body: updateClinicalFollowUpRequestSchema.parse(input),
        ...(signal ? { signal } : {}),
      }),
    );
  },

  async complete(
    id: string,
    input: CompleteClinicalFollowUpRequest,
    signal?: AbortSignal,
  ): Promise<ClinicalFollowUpDetail> {
    return clinicalFollowUpDetailSchema.parse(
      await apiClient(`/follow-ups/${id}/complete`, {
        method: 'POST',
        body: completeClinicalFollowUpRequestSchema.parse(input),
        ...(signal ? { signal } : {}),
      }),
    );
  },

  async void(
    id: string,
    input: VoidClinicalFollowUpRequest,
    signal?: AbortSignal,
  ): Promise<ClinicalFollowUpDetail> {
    return clinicalFollowUpDetailSchema.parse(
      await apiClient(`/follow-ups/${id}/void`, {
        method: 'POST',
        body: voidClinicalFollowUpRequestSchema.parse(input),
        ...(signal ? { signal } : {}),
      }),
    );
  },
};
