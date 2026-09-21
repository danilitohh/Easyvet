import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PrescriptionDetail, PrescriptionListResponse } from '@veterinary-saas/contracts';
import { appConfig } from '../../config/app';
import { useActiveOrganizationId } from '../shared/hooks';
import { prescriptionsApi } from './prescriptionsApi';

type ResourceState<T> = {
  data: T | null;
  loading: boolean;
  error: unknown;
  reload: () => void;
};

const EMPTY_LIST: PrescriptionListResponse = {
  data: [],
  pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function usePrescriptionResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  enabled: boolean,
  dependencies: readonly unknown[],
  mockValue: T,
): ResourceState<T> {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<Omit<ResourceState<T>, 'reload'>>({
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
    // Tenant and route dependencies are supplied by each prescription resource.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, revision, ...dependencies]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return useMemo(() => ({ ...state, reload }), [reload, state]);
}

export function usePatientPrescriptions(
  patientId: string | undefined,
  options: { page?: number; pageSize?: number; clinicalEncounterId?: string } = {},
  enabled = true,
): ResourceState<PrescriptionListResponse> {
  const organizationId = useActiveOrganizationId();
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 20;
  const clinicalEncounterId = options.clinicalEncounterId;
  const loader = useCallback(
    (signal: AbortSignal) =>
      patientId
        ? prescriptionsApi.listByPatient(patientId, { page, pageSize, clinicalEncounterId }, signal)
        : Promise.reject(new Error('Paciente requerido')),
    [clinicalEncounterId, page, pageSize, patientId],
  );
  return usePrescriptionResource(
    loader,
    enabled && Boolean(patientId) && (appConfig.dataMode === 'mock' || Boolean(organizationId)),
    [organizationId, patientId, page, pageSize, clinicalEncounterId],
    EMPTY_LIST,
  );
}

export function useEncounterPrescriptions(
  patientId: string | undefined,
  encounterId: string | undefined,
  enabled = true,
): ResourceState<PrescriptionListResponse> {
  return usePatientPrescriptions(
    patientId,
    encounterId ? { clinicalEncounterId: encounterId } : {},
    enabled,
  );
}

export function usePrescription(
  prescriptionId: string | undefined,
  enabled = true,
): ResourceState<PrescriptionDetail> {
  const organizationId = useActiveOrganizationId();
  const loader = useCallback(
    (signal: AbortSignal) =>
      prescriptionId
        ? prescriptionsApi.findById(prescriptionId, signal)
        : Promise.reject(new Error('Prescripción requerida')),
    [prescriptionId],
  );
  return usePrescriptionResource(
    loader,
    enabled &&
      Boolean(prescriptionId) &&
      (appConfig.dataMode === 'mock' || Boolean(organizationId)),
    [organizationId, prescriptionId],
    null as unknown as PrescriptionDetail,
  );
}
