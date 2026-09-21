import {
  createPrescriptionRequestSchema,
  finalizePrescriptionRequestSchema,
  prescriptionDetailSchema,
  prescriptionListQuerySchema,
  prescriptionListResponseSchema,
  updatePrescriptionRequestSchema,
  voidPrescriptionRequestSchema,
  type CreatePrescriptionRequest,
  type FinalizePrescriptionRequest,
  type PrescriptionDetail,
  type PrescriptionListQuery,
  type PrescriptionListResponse,
  type UpdatePrescriptionRequest,
  type VoidPrescriptionRequest,
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

  async create(
    encounterId: string,
    input: CreatePrescriptionRequest,
    signal?: AbortSignal,
  ): Promise<PrescriptionDetail> {
    return prescriptionDetailSchema.parse(
      await apiClient(`/clinical-encounters/${encounterId}/prescriptions`, {
        method: 'POST',
        body: createPrescriptionRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },

  async updateDraft(
    prescriptionId: string,
    input: UpdatePrescriptionRequest,
    signal?: AbortSignal,
  ): Promise<PrescriptionDetail> {
    return prescriptionDetailSchema.parse(
      await apiClient(`/prescriptions/${prescriptionId}`, {
        method: 'PATCH',
        body: updatePrescriptionRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },

  async finalize(
    prescriptionId: string,
    input: FinalizePrescriptionRequest,
    signal?: AbortSignal,
  ): Promise<PrescriptionDetail> {
    return prescriptionDetailSchema.parse(
      await apiClient(`/prescriptions/${prescriptionId}/finalize`, {
        method: 'POST',
        body: finalizePrescriptionRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },

  async void(
    prescriptionId: string,
    input: VoidPrescriptionRequest,
    signal?: AbortSignal,
  ): Promise<PrescriptionDetail> {
    return prescriptionDetailSchema.parse(
      await apiClient(`/prescriptions/${prescriptionId}/void`, {
        method: 'POST',
        body: voidPrescriptionRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },
};
