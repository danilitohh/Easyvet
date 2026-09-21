import {
  prescriptionDetailSchema,
  prescriptionListQuerySchema,
  prescriptionListResponseSchema,
  type PrescriptionDetail,
  type PrescriptionListQuery,
  type PrescriptionListResponse,
} from '@veterinary-saas/contracts';
import { apiClient } from '../../services/apiClient';

type SignalInput = { signal?: AbortSignal };

function signalInit(signal?: AbortSignal): SignalInput {
  return signal ? { signal } : {};
}

function queryString(values: PrescriptionListQuery): string {
  const parsed = prescriptionListQuerySchema.parse(values);
  const query = new URLSearchParams();
  query.set('page', String(parsed.page));
  query.set('pageSize', String(parsed.pageSize));
  if (parsed.status) query.set('status', parsed.status);
  if (parsed.clinicalEncounterId) query.set('clinicalEncounterId', parsed.clinicalEncounterId);
  return `?${query.toString()}`;
}

// Prescription API methods keep all browser calls tenant-aware and validate responses at the boundary.
export const prescriptionsApi = {
  async listByPatient(
    patientId: string,
    query: PrescriptionListQuery = { page: 1, pageSize: 20 },
    signal?: AbortSignal,
  ): Promise<PrescriptionListResponse> {
    return prescriptionListResponseSchema.parse(
      await apiClient(
        `/patients/${patientId}/prescriptions${queryString(query)}`,
        signalInit(signal),
      ),
    );
  },

  async findById(prescriptionId: string, signal?: AbortSignal): Promise<PrescriptionDetail> {
    return prescriptionDetailSchema.parse(
      await apiClient(`/prescriptions/${prescriptionId}`, signalInit(signal)),
    );
  },
};
