import {
  createPatientRequestSchema,
  patientResponseSchema,
  patientsListResponseSchema,
  updatePatientRequestSchema,
  type CreatePatientRequest,
  type PatientResponse,
  type PatientsListResponse,
  type UpdatePatientRequest,
} from '@veterinary-saas/contracts';
import { apiClient } from '../../services/apiClient';

export type PatientListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: 'ACTIVE' | 'ARCHIVED' | 'ALL';
  sortBy?: 'createdAt' | 'name' | 'species';
  sortDirection?: 'asc' | 'desc';
};

function toQuery(params: PatientListParams): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

// Patients API keeps patient transport and response parsing separate from page components.
export const patientsApi = {
  async list(params: PatientListParams = {}): Promise<PatientsListResponse> {
    return patientsListResponseSchema.parse(await apiClient(`/patients${toQuery(params)}`));
  },
  async findById(patientId: string): Promise<PatientResponse> {
    return patientResponseSchema.parse(await apiClient(`/patients/${patientId}`));
  },
  async create(input: CreatePatientRequest): Promise<PatientResponse> {
    return patientResponseSchema.parse(
      await apiClient('/patients', {
        method: 'POST',
        body: createPatientRequestSchema.parse(input),
      }),
    );
  },
  async update(patientId: string, input: UpdatePatientRequest): Promise<PatientResponse> {
    return patientResponseSchema.parse(
      await apiClient(`/patients/${patientId}`, {
        method: 'PATCH',
        body: updatePatientRequestSchema.parse(input),
      }),
    );
  },
  async archive(patientId: string): Promise<PatientResponse> {
    return patientResponseSchema.parse(
      await apiClient(`/patients/${patientId}/archive`, { method: 'POST', body: {} }),
    );
  },
};
