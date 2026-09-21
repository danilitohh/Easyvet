import { useCallback } from 'react';
import type { VaccinationDetail, VaccinationListResponse } from '@veterinary-saas/contracts';
import { appConfig } from '../../config/app';
import { useActiveOrganizationId } from '../shared/hooks';
import { vaccinationsApi } from './vaccinationsApi';
import { usePreventiveResource } from './usePreventiveResource';

const EMPTY_LIST: VaccinationListResponse = {
  data: [],
  pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
};

// Vaccination list state is independently paginated and tenant-keyed.
export function usePatientVaccinations(
  patientId: string | undefined,
  options: { page?: number; pageSize?: number; clinicalEncounterId?: string } = {},
  enabled = true,
) {
  const organizationId = useActiveOrganizationId();
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 20;
  const clinicalEncounterId = options.clinicalEncounterId;
  const loader = useCallback(
    (signal: AbortSignal) =>
      patientId
        ? vaccinationsApi.listByPatient(patientId, { page, pageSize, clinicalEncounterId }, signal)
        : Promise.reject(new Error('Paciente requerido')),
    [clinicalEncounterId, page, pageSize, patientId],
  );

  return usePreventiveResource<VaccinationListResponse>(
    loader,
    enabled && Boolean(patientId) && (appConfig.dataMode === 'mock' || Boolean(organizationId)),
    [patientId, page, pageSize, clinicalEncounterId],
    EMPTY_LIST,
  );
}

export function useEncounterVaccinations(
  patientId: string | undefined,
  encounterId: string | undefined,
  enabled = true,
) {
  return usePatientVaccinations(
    patientId,
    encounterId ? { clinicalEncounterId: encounterId } : {},
    enabled,
  );
}

export function useVaccination(vaccinationId: string | undefined, enabled = true) {
  const organizationId = useActiveOrganizationId();
  const loader = useCallback(
    (signal: AbortSignal) =>
      vaccinationId
        ? vaccinationsApi.findById(vaccinationId, signal)
        : Promise.reject(new Error('Vacunación requerida')),
    [vaccinationId],
  );

  return usePreventiveResource<VaccinationDetail>(
    loader,
    enabled && Boolean(vaccinationId) && (appConfig.dataMode === 'mock' || Boolean(organizationId)),
    [vaccinationId],
    null as unknown as VaccinationDetail,
  );
}
