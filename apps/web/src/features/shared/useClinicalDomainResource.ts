import { useCallback, useEffect, useRef, useState } from 'react';
import { appConfig } from '../../config/app';
import { useActiveOrganizationId } from './hooks';
import { proceduresApi } from '../procedures/proceduresApi';
import { anesthesiaApi } from '../anesthesia/anesthesiaApi';
import { hospitalizationsApi } from '../hospitalizations/hospitalizationsApi';

export type ClinicalDomainLoadState<T> = {
  data: T | null;
  loading: boolean;
  error: unknown;
  reload: () => void;
};
type ResourceResult<T> = Omit<ClinicalDomainLoadState<T>, 'reload'> & { key: string };

// Keyed result state prevents a previous tenant's clinical data flashing while the next read starts.
function useClinicalDomainResource<T>(
  key: string,
  enabled: boolean,
  loader: (signal: AbortSignal) => Promise<T>,
): ClinicalDomainLoadState<T> {
  const organizationId = useActiveOrganizationId();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<ResourceResult<T>>({
    key: '',
    data: null,
    loading: false,
    error: null,
  });
  const resourceKey = `${organizationId ?? 'mock'}:${key}`;

  useEffect(() => {
    const controller = new AbortController();
    setResult({ key: resourceKey, data: null, loading: enabled, error: null });
    if (!enabled) return () => controller.abort();
    if (appConfig.dataMode === 'mock') {
      setResult({
        key: resourceKey,
        data: null,
        loading: false,
        error: new Error('Esta sección requiere la API clínica conectada.'),
      });
      return () => controller.abort();
    }
    void loader(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setResult({ key: resourceKey, data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (
          !controller.signal.aborted &&
          !(error instanceof DOMException && error.name === 'AbortError')
        ) {
          setResult({ key: resourceKey, data: null, loading: false, error });
        }
      });
    return () => controller.abort();
    // Callers key loaders by tenant and route data; revision is the explicit reload trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, resourceKey, revision]);

  const reload = useCallback(() => setRevision((current) => current + 1), []);
  if (result.key !== resourceKey) return { data: null, loading: enabled, error: null, reload };
  return { data: result.data, loading: result.loading, error: result.error, reload };
}

const EMPTY_PROCEDURES = {
  data: [],
  pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
} as const;
const EMPTY_ANESTHESIA = {
  data: [],
  pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
} as const;
const EMPTY_OBSERVATIONS = {
  data: [],
  pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
} as const;
const EMPTY_HOSPITALIZATIONS = {
  data: [],
  pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
} as const;
const EMPTY_HOSPITALIZATION_ENTRIES = {
  data: [],
  pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
} as const;

export function useProcedureListResource(
  patientId: string | undefined,
  page: number,
  enabled: boolean,
  clinicalEncounterId?: string,
) {
  return useClinicalDomainResource(
    `procedures:${patientId ?? ''}:${page}:${clinicalEncounterId ?? ''}`,
    enabled && Boolean(patientId),
    (signal) =>
      proceduresApi.listByPatient(patientId!, { page, pageSize: 20, clinicalEncounterId }, signal),
  );
}

export function useProcedureResource(procedureId: string | undefined, enabled: boolean) {
  return useClinicalDomainResource(
    `procedure:${procedureId ?? ''}`,
    enabled && Boolean(procedureId),
    (signal) => proceduresApi.findById(procedureId!, signal),
  );
}

export function useAnesthesiaListResource(
  patientId: string | undefined,
  page: number,
  enabled: boolean,
  clinicalEncounterId?: string,
) {
  return useClinicalDomainResource(
    `anesthesia-list:${patientId ?? ''}:${page}:${clinicalEncounterId ?? ''}`,
    enabled && Boolean(patientId),
    (signal) =>
      anesthesiaApi.listByPatient(patientId!, { page, pageSize: 20, clinicalEncounterId }, signal),
  );
}

export function useAnesthesiaResource(recordId: string | undefined, enabled: boolean) {
  return useClinicalDomainResource(
    `anesthesia:${recordId ?? ''}`,
    enabled && Boolean(recordId),
    (signal) => anesthesiaApi.findById(recordId!, signal),
  );
}

export function useAnesthesiaObservationsResource(
  recordId: string | undefined,
  page: number,
  enabled: boolean,
) {
  return useClinicalDomainResource(
    `anesthesia-observations:${recordId ?? ''}:${page}`,
    enabled && Boolean(recordId),
    (signal) => anesthesiaApi.listObservations(recordId!, { page, pageSize: 100 }, signal),
  );
}

// Hospitalization history is scoped by patient, page and optional encounter under the active tenant.
export function useHospitalizationListResource(
  patientId: string | undefined,
  page: number,
  enabled: boolean,
  clinicalEncounterId?: string,
) {
  return useClinicalDomainResource(
    `hospitalizations:${patientId ?? ''}:${page}:${clinicalEncounterId ?? ''}`,
    enabled && Boolean(patientId),
    (signal) =>
      hospitalizationsApi.listByPatient(
        patientId!,
        { page, pageSize: 20, ...(clinicalEncounterId ? { clinicalEncounterId } : {}) },
        signal,
      ),
  );
}

// Detail and Kardex reads abort on tenant changes and never render a result keyed to another tenant.
export function useHospitalizationResource(id: string | undefined, enabled: boolean) {
  return useClinicalDomainResource(
    `hospitalization:${id ?? ''}`,
    enabled && Boolean(id),
    (signal) => hospitalizationsApi.findById(id!, signal),
  );
}

export function useHospitalizationEntriesResource(
  id: string | undefined,
  page: number,
  enabled: boolean,
) {
  return useClinicalDomainResource(
    `hospitalization-entries:${id ?? ''}:${page}`,
    enabled && Boolean(id),
    (signal) => hospitalizationsApi.listEntries(id!, page, signal),
  );
}

// Mutations are canceled when the active organization changes or the owning screen unmounts.
export function useClinicalMutationGuard() {
  const organizationId = useActiveOrganizationId();
  const controllerRef = useRef<AbortController | null>(null);
  const tenantRef = useRef(organizationId);
  useEffect(() => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    tenantRef.current = organizationId;
    return () => controllerRef.current?.abort();
  }, [organizationId]);
  return {
    signal: () => controllerRef.current?.signal,
    isCurrent: () => !controllerRef.current?.signal.aborted && tenantRef.current === organizationId,
  };
}

export {
  EMPTY_ANESTHESIA,
  EMPTY_HOSPITALIZATION_ENTRIES,
  EMPTY_HOSPITALIZATIONS,
  EMPTY_OBSERVATIONS,
  EMPTY_PROCEDURES,
};
