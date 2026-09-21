import {
  clinicalEncounterListResponseSchema,
  clinicalEncounterResponseSchema,
  clinicalEvolutionListResponseSchema,
  clinicalRecordEnvelopeSchema,
  clinicalVitalListResponseSchema,
  clinicalVitalResponseSchema,
  clinicalPractitionerListResponseSchema,
  createClinicalEncounterRequestSchema,
  createClinicalVitalRequestSchema,
  professionalProfileResponseSchema,
  upsertProfessionalProfileRequestSchema,
  updateClinicalEncounterRequestSchema,
  organizationCurrentResponseSchema,
  type ClinicalEncounterListResponse,
  type ClinicalEncounterResponse,
  type ClinicalEvolutionListResponse,
  type ClinicalRecordEnvelope,
  type ClinicalVitalListResponse,
  type ClinicalVitalResponse,
  type OrganizationCurrentResponse,
  type CreateClinicalEncounterRequest,
  type UpdateClinicalEncounterRequest,
  type CreateClinicalVitalRequest,
  type ProfessionalProfileResponse,
  type ClinicalPractitionerListResponse,
} from '@veterinary-saas/contracts';
import { apiClient } from '../../services/apiClient';

type SignalInput = { signal?: AbortSignal };

function signalInit(signal?: AbortSignal): SignalInput {
  return signal ? { signal } : {};
}

function queryString(values: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, value);
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

// Clinical API keeps request validation and response parsing at the browser boundary while
// exposing only draft/vital operations for this phase (finalize/void/evolution remain later work).
export const clinicalApi = {
  async currentOrganization(signal?: AbortSignal): Promise<OrganizationCurrentResponse> {
    return organizationCurrentResponseSchema.parse(
      await apiClient('/organization/current', signalInit(signal)),
    );
  },

  async getRecord(patientId: string, signal?: AbortSignal): Promise<ClinicalRecordEnvelope> {
    return clinicalRecordEnvelopeSchema.parse(
      await apiClient(`/patients/${patientId}/clinical-record`, signalInit(signal)),
    );
  },

  async listEncounters(
    patientId: string,
    params: { page: number; pageSize: number; signal?: AbortSignal },
  ): Promise<ClinicalEncounterListResponse> {
    return clinicalEncounterListResponseSchema.parse(
      await apiClient(
        `/patients/${patientId}/clinical-encounters${queryString({
          page: String(params.page),
          pageSize: String(params.pageSize),
        })}`,
        signalInit(params.signal),
      ),
    );
  },

  async findEncounter(
    encounterId: string,
    signal?: AbortSignal,
  ): Promise<ClinicalEncounterResponse> {
    return clinicalEncounterResponseSchema.parse(
      await apiClient(`/clinical-encounters/${encounterId}`, signalInit(signal)),
    );
  },

  async createEncounter(
    patientId: string,
    input: CreateClinicalEncounterRequest,
  ): Promise<ClinicalEncounterResponse> {
    return clinicalEncounterResponseSchema.parse(
      await apiClient(`/patients/${patientId}/clinical-encounters`, {
        method: 'POST',
        body: createClinicalEncounterRequestSchema.parse(input),
      }),
    );
  },

  async updateEncounter(
    encounterId: string,
    input: UpdateClinicalEncounterRequest,
  ): Promise<ClinicalEncounterResponse> {
    return clinicalEncounterResponseSchema.parse(
      await apiClient(`/clinical-encounters/${encounterId}`, {
        method: 'PATCH',
        body: updateClinicalEncounterRequestSchema.parse(input),
      }),
    );
  },

  async listVitals(encounterId: string, signal?: AbortSignal): Promise<ClinicalVitalListResponse> {
    return clinicalVitalListResponseSchema.parse(
      await apiClient(`/clinical-encounters/${encounterId}/vitals`, signalInit(signal)),
    );
  },

  async addVital(
    encounterId: string,
    input: CreateClinicalVitalRequest,
  ): Promise<ClinicalVitalResponse> {
    return clinicalVitalResponseSchema.parse(
      await apiClient(`/clinical-encounters/${encounterId}/vitals`, {
        method: 'POST',
        body: createClinicalVitalRequestSchema.parse(input),
      }),
    );
  },

  async professionalProfile(signal?: AbortSignal): Promise<ProfessionalProfileResponse> {
    return professionalProfileResponseSchema.parse(
      await apiClient('/clinical/me/professional-profile', signalInit(signal)),
    );
  },

  async updateProfessionalProfile(input: {
    displayName: string;
    licenseNumber?: string | null;
  }): Promise<ProfessionalProfileResponse> {
    return professionalProfileResponseSchema.parse(
      await apiClient('/clinical/me/professional-profile', {
        method: 'PUT',
        body: upsertProfessionalProfileRequestSchema.parse(input),
      }),
    );
  },

  async listPractitioners(signal?: AbortSignal): Promise<ClinicalPractitionerListResponse> {
    return clinicalPractitionerListResponseSchema.parse(
      await apiClient('/clinical/practitioners', signalInit(signal)),
    );
  },

  async listEvolutions(
    patientId: string,
    params: { page: number; pageSize: number; signal?: AbortSignal },
  ): Promise<ClinicalEvolutionListResponse> {
    return clinicalEvolutionListResponseSchema.parse(
      await apiClient(
        `/patients/${patientId}/clinical-evolutions${queryString({
          page: String(params.page),
          pageSize: String(params.pageSize),
        })}`,
        signalInit(params.signal),
      ),
    );
  },
};
