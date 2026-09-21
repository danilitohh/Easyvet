import {
  clinicalEncounterListResponseSchema,
  clinicalEncounterResponseSchema,
  clinicalEvolutionListResponseSchema,
  clinicalRecordEnvelopeSchema,
  clinicalVitalListResponseSchema,
  organizationCurrentResponseSchema,
  type ClinicalEncounterListResponse,
  type ClinicalEncounterResponse,
  type ClinicalEvolutionListResponse,
  type ClinicalRecordEnvelope,
  type ClinicalVitalListResponse,
  type OrganizationCurrentResponse,
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

// Clinical API is intentionally read-only here; write endpoints are kept out of this module.
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

  async listVitals(encounterId: string, signal?: AbortSignal): Promise<ClinicalVitalListResponse> {
    return clinicalVitalListResponseSchema.parse(
      await apiClient(`/clinical-encounters/${encounterId}/vitals`, signalInit(signal)),
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
