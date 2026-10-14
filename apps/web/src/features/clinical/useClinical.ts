import { useCallback, useEffect, useMemo, useState } from 'react';
import { appConfig } from '../../config/app';
import { useActiveOrganizationId } from '../shared/hooks';
import type {
  ClinicalEncounterListResponse,
  ClinicalEncounterResponse,
  ClinicalEvolutionListResponse,
  ClinicalRecordEnvelope,
  ClinicalVitalListResponse,
  OrganizationCurrentResponse,
  ClinicalPractitionerListResponse,
  ClinicalMemberListResponse,
} from '@veterinary-saas/contracts';
import { clinicalApi } from './clinicalApi';
import { useRealtimeRevision } from '../../contexts/useRealtime';

type LoadState<T> = { data: T | null; loading: boolean; error: unknown; reload: () => void };

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function useClinicalResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  enabled: boolean,
  dependencies: readonly unknown[],
  mockValue: T,
): LoadState<T> {
  const realtimeRevision = useRealtimeRevision();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<Omit<LoadState<T>, 'reload'>>({
    data: null,
    loading: enabled,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, loading: enabled, error: null });
    if (!enabled) return () => controller.abort();
    if (appConfig.dataMode === 'mock') {
      setState({ data: mockValue, loading: false, error: null });
      return () => controller.abort();
    }
    void loader(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && !isAbortError(error)) {
          setState({ data: null, loading: false, error });
        }
      });
    return () => controller.abort();
    // Each clinical resource supplies its tenant and query dependencies explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, revision, realtimeRevision, ...dependencies]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return useMemo(() => ({ ...state, reload }), [reload, state]);
}

const EMPTY_ENCOUNTERS: ClinicalEncounterListResponse = {
  data: [],
  pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
};
const EMPTY_EVOLUTIONS: ClinicalEvolutionListResponse = {
  data: [],
  pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
};
const EMPTY_VITALS: ClinicalVitalListResponse = { data: [] };
const EMPTY_PRACTITIONERS: ClinicalPractitionerListResponse = { data: [] };
const EMPTY_CLINICAL_MEMBERS: ClinicalMemberListResponse = { data: [] };

// Clinical reads are tenant-keyed and abort in-flight requests on organization changes.
export function useClinicalOrganization(): LoadState<OrganizationCurrentResponse> {
  const organizationId = useActiveOrganizationId();
  return useClinicalResource(
    (signal) => clinicalApi.currentOrganization(signal),
    appConfig.dataMode === 'mock' || Boolean(organizationId),
    [organizationId],
    {
      id: '00000000-0000-4000-8000-000000000010',
      name: 'Demo Easyvet',
      slug: 'demo-easyvet',
      status: 'ACTIVE',
      timezone: 'America/Bogota',
      locale: 'es-CO',
      currencyCode: 'COP',
    },
  );
}

// Profile and practitioner resources are keyed by the active tenant so switching organization
// immediately clears the previous membership's identity from the form.
export function useProfessionalProfile(enabled: boolean) {
  const organizationId = useActiveOrganizationId();
  return useClinicalResource(
    (signal) => clinicalApi.professionalProfile(signal),
    enabled && (appConfig.dataMode === 'mock' || Boolean(organizationId)),
    [organizationId],
    { membershipId: '00000000-0000-4000-8000-000000000000', displayName: '', licenseNumber: null },
  );
}

export function useClinicalPractitioners(enabled: boolean) {
  const organizationId = useActiveOrganizationId();
  return useClinicalResource(
    (signal) => clinicalApi.listPractitioners(signal),
    enabled && (appConfig.dataMode === 'mock' || Boolean(organizationId)),
    [organizationId],
    EMPTY_PRACTITIONERS,
  );
}

export function useClinicalMembers(enabled: boolean) {
  const organizationId = useActiveOrganizationId();
  return useClinicalResource(
    (signal) => clinicalApi.listClinicalMembers(signal),
    enabled && (appConfig.dataMode === 'mock' || Boolean(organizationId)),
    [organizationId],
    EMPTY_CLINICAL_MEMBERS,
  );
}

export function useClinicalRecord(patientId: string | undefined, enabled: boolean) {
  const organizationId = useActiveOrganizationId();
  const state = useClinicalResource<ClinicalRecordEnvelope>(
    (signal) =>
      patientId
        ? clinicalApi.getRecord(patientId, signal)
        : Promise.reject(new Error('Paciente requerido')),
    enabled && Boolean(patientId) && (appConfig.dataMode === 'mock' || Boolean(organizationId)),
    [organizationId, patientId],
    { clinicalRecord: null },
  );
  return { ...state, record: state.data?.clinicalRecord ?? null };
}

export function useClinicalEncounters(
  patientId: string | undefined,
  page: number,
  enabled: boolean,
): LoadState<ClinicalEncounterListResponse> {
  const organizationId = useActiveOrganizationId();
  return useClinicalResource(
    (signal) =>
      patientId
        ? clinicalApi.listEncounters(patientId, { page, pageSize: 20, signal })
        : Promise.reject(new Error('Paciente requerido')),
    enabled && Boolean(patientId) && (appConfig.dataMode === 'mock' || Boolean(organizationId)),
    [organizationId, patientId, page],
    EMPTY_ENCOUNTERS,
  );
}

export function useClinicalEncounter(
  encounterId: string | undefined,
  enabled: boolean,
): LoadState<ClinicalEncounterResponse> {
  const organizationId = useActiveOrganizationId();
  return useClinicalResource(
    (signal) =>
      encounterId
        ? clinicalApi.findEncounter(encounterId, signal)
        : Promise.reject(new Error('Encuentro requerido')),
    enabled && Boolean(encounterId) && (appConfig.dataMode === 'mock' || Boolean(organizationId)),
    [organizationId, encounterId],
    null as unknown as ClinicalEncounterResponse,
  );
}

export function useClinicalVitals(encounterId: string | undefined, enabled: boolean) {
  const organizationId = useActiveOrganizationId();
  const state = useClinicalResource(
    (signal) =>
      encounterId
        ? clinicalApi.listVitals(encounterId, signal)
        : Promise.reject(new Error('Encuentro requerido')),
    enabled && Boolean(encounterId) && (appConfig.dataMode === 'mock' || Boolean(organizationId)),
    [organizationId, encounterId],
    EMPTY_VITALS,
  );
  return { ...state, vitals: state.data?.data ?? [] };
}

export function useClinicalEvolutions(
  patientId: string | undefined,
  page: number,
  enabled: boolean,
): LoadState<ClinicalEvolutionListResponse> {
  const organizationId = useActiveOrganizationId();
  return useClinicalResource(
    (signal) =>
      patientId
        ? clinicalApi.listEvolutions(patientId, { page, pageSize: 20, signal })
        : Promise.reject(new Error('Paciente requerido')),
    enabled && Boolean(patientId) && (appConfig.dataMode === 'mock' || Boolean(organizationId)),
    [organizationId, patientId, page],
    EMPTY_EVOLUTIONS,
  );
}
