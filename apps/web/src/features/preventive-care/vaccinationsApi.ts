import {
  vaccinationDetailSchema,
  vaccinationListQuerySchema,
  vaccinationListResponseSchema,
  type VaccinationDetail,
  type VaccinationListQuery,
  type VaccinationListResponse,
} from '@veterinary-saas/contracts';
import { apiClient } from '../../services/apiClient';

type SignalInput = { signal?: AbortSignal };

function signalInit(signal?: AbortSignal): SignalInput {
  return signal ? { signal } : {};
}

function queryString(query: VaccinationListQuery): string {
  const parsed = vaccinationListQuerySchema.parse(query);
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

// Vaccination calls stay independent from deworming calls so contracts and permissions remain explicit.
export const vaccinationsApi = {
  async listByPatient(
    patientId: string,
    query: VaccinationListQuery = { page: 1, pageSize: 20 },
    signal?: AbortSignal,
  ): Promise<VaccinationListResponse> {
    return vaccinationListResponseSchema.parse(
      await apiClient(
        `/patients/${patientId}/vaccinations${queryString(query)}`,
        signalInit(signal),
      ),
    );
  },

  async findById(vaccinationId: string, signal?: AbortSignal): Promise<VaccinationDetail> {
    return vaccinationDetailSchema.parse(
      await apiClient(`/vaccinations/${vaccinationId}`, signalInit(signal)),
    );
  },
};
