import { useCallback, useMemo } from 'react';
import type { PatientResponse, PatientsListResponse } from '@veterinary-saas/contracts';
import { appConfig } from '../../config/app';
import { useActiveOrganizationId, useTenantResource } from '../shared/hooks';
import { patientsApi, type PatientListParams } from './patientsApi';

const EMPTY_PATIENTS: PatientsListResponse = {
  data: [],
  pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
};

// Patient lists use the same tenant-reset strategy as Owners and never retain the previous org rows.
export function usePatients(params: PatientListParams = {}) {
  const organizationId = useActiveOrganizationId();
  const normalizedParams = useMemo(() => params, [params]);
  const loader = useCallback(() => patientsApi.list(normalizedParams), [normalizedParams]);
  return useTenantResource({
    loader,
    enabled: appConfig.dataMode === 'mock' || Boolean(organizationId),
    debounceMs: normalizedParams.search ? 320 : 0,
    mockValue: EMPTY_PATIENTS,
  });
}

const EMPTY_PATIENT: PatientResponse | null = null;

// Patient detail state is scoped to the active organization and route identifier.
export function usePatient(patientId: string | undefined) {
  const organizationId = useActiveOrganizationId();
  const loader = useCallback(
    () =>
      patientId ? patientsApi.findById(patientId) : Promise.reject(new Error('Patient requerido')),
    [patientId],
  );
  const state = useTenantResource({
    loader,
    enabled: (appConfig.dataMode === 'mock' || Boolean(organizationId)) && Boolean(patientId),
    mockValue: EMPTY_PATIENT,
  });
  return { ...state, patient: state.data };
}
