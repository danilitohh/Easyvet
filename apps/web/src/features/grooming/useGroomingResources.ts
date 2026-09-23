import { useCallback, useEffect, useState } from 'react';
import type {
  GroomingGroomerOption,
  GroomingVisit,
  GroomingVisitListQuery,
  LocationResponse,
  PatientsListResponse,
  AppointmentListResponse,
} from '@veterinary-saas/contracts';
import { appConfig } from '../../config/app';
import { agendaApi } from '../agenda/agendaApi';
import { useActiveOrganizationId } from '../shared/hooks';
import { groomingApi } from './groomingApi';

type ResourceState<T> = { data: T | null; loading: boolean; error: unknown; reload: () => void };
type KeyedResult<T> = Omit<ResourceState<T>, 'reload'> & { key: string };

// A tenant- and query-keyed loader aborts stale requests and never flashes another tenant's data.
function useGroomingResource<T>(
  key: string,
  enabled: boolean,
  loader: (signal: AbortSignal) => Promise<T>,
): ResourceState<T> {
  const organizationId = useActiveOrganizationId();
  const [revision, setRevision] = useState(0);
  const resourceKey = `${organizationId ?? 'none'}:${key}`;
  const [result, setResult] = useState<KeyedResult<T>>({
    key: '',
    data: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    setResult({ key: resourceKey, data: null, loading: enabled, error: null });
    if (!enabled || !organizationId) return () => controller.abort();
    if (appConfig.dataMode === 'mock') {
      setResult({
        key: resourceKey,
        data: null,
        loading: false,
        error: new Error('Peluquería requiere la API conectada.'),
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
    // Callers bind each resource to tenant and route data; revision is the explicit refresh trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, resourceKey, revision]);

  const reload = useCallback(() => setRevision((current) => current + 1), []);
  if (result.key !== resourceKey) return { data: null, loading: enabled, error: null, reload };
  return { data: result.data, loading: result.loading, error: result.error, reload };
}

export function useGroomingListResource(
  query: GroomingVisitListQuery,
  enabled: boolean,
  patientId?: string,
) {
  const key = `list:${patientId ?? 'queue'}:${JSON.stringify(query)}`;
  return useGroomingResource(key, enabled, (signal) =>
    patientId
      ? groomingApi.listByPatient(patientId, query, signal)
      : groomingApi.list(query, signal),
  );
}

export function useGroomingVisitResource(id: string | undefined, enabled: boolean) {
  return useGroomingResource(`visit:${id ?? ''}`, enabled && Boolean(id), (signal) =>
    groomingApi.findById(id!, signal),
  );
}

type GroomingOptions = {
  patients: PatientsListResponse;
  locations: LocationResponse[];
  groomers: GroomingGroomerOption[];
};

// Assignment options never include raw member emails or personal contact details.
export function useGroomingOptions(enabled: boolean) {
  return useGroomingResource<GroomingOptions>('options', enabled, async (signal) => {
    const [patients, locations, groomers] = await Promise.all([
      agendaApi.listPatients({ page: 1, pageSize: 100, signal }),
      agendaApi.listLocations(signal),
      groomingApi.groomers(signal),
    ]);
    return { patients, locations, groomers };
  });
}

export function useGroomingAppointments(
  patientId: string | undefined,
  enabled: boolean,
  currentAppointmentId?: string | null,
) {
  return useGroomingResource<AppointmentListResponse>(
    `appointments:${patientId ?? ''}:${currentAppointmentId ?? ''}`,
    enabled && Boolean(patientId),
    (signal) => groomingApi.appointmentsForPatient(patientId!, currentAppointmentId, signal),
  );
}

export function useGroomingPatientHistory(patientId: string | undefined, enabled: boolean) {
  return useGroomingListResource(
    { page: 1, pageSize: 100 },
    enabled && Boolean(patientId),
    patientId,
  );
}

export type { GroomingVisit };
