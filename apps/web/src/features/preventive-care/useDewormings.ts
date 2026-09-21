import { useCallback } from 'react';
import type { DewormingDetail, DewormingListResponse } from '@veterinary-saas/contracts';
import { appConfig } from '../../config/app';
import { useActiveOrganizationId } from '../shared/hooks';
import { dewormingsApi } from './dewormingsApi';
import { usePreventiveResource } from './usePreventiveResource';

const EMPTY_LIST: DewormingListResponse = {
  data: [],
  pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
};

// Deworming list state intentionally does not share vaccination pagination or cache keys.
export function usePatientDewormings(
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
        ? dewormingsApi.listByPatient(patientId, { page, pageSize, clinicalEncounterId }, signal)
        : Promise.reject(new Error('Paciente requerido')),
    [clinicalEncounterId, page, pageSize, patientId],
  );

  return usePreventiveResource<DewormingListResponse>(
    loader,
    enabled && Boolean(patientId) && (appConfig.dataMode === 'mock' || Boolean(organizationId)),
    [patientId, page, pageSize, clinicalEncounterId],
    EMPTY_LIST,
  );
}

export function useEncounterDewormings(
  patientId: string | undefined,
  encounterId: string | undefined,
  enabled = true,
) {
  return usePatientDewormings(
    patientId,
    encounterId ? { clinicalEncounterId: encounterId } : {},
    enabled,
  );
}

export function useDeworming(dewormingId: string | undefined, enabled = true) {
  const organizationId = useActiveOrganizationId();
  const loader = useCallback(
    (signal: AbortSignal) =>
      dewormingId
        ? dewormingsApi.findById(dewormingId, signal)
        : Promise.reject(new Error('Desparasitación requerida')),
    [dewormingId],
  );

  return usePreventiveResource<DewormingDetail>(
    loader,
    enabled && Boolean(dewormingId) && (appConfig.dataMode === 'mock' || Boolean(organizationId)),
    [dewormingId],
    null as unknown as DewormingDetail,
  );
}
