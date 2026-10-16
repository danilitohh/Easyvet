import { useCallback, useEffect, useMemo, useState } from 'react';
import { appConfig } from '../../config/app';
import { useCan } from '../../auth/useCan';
import { PERMISSION } from '../../auth/permissions';
import { useActiveOrganizationId } from '../shared/hooks';
import type {
  AppointmentListResponse,
  AppointmentResponse,
  AvailabilityRuleResponse,
  AvailableSlotsResponse,
  LocationResponse,
  OrganizationCurrentResponse,
  PaginatedMembershipResponse,
  PatientsListResponse,
} from '@veterinary-saas/contracts';
import {
  agendaApi,
  type AgendaListParams,
  type AgendaMembershipParams,
  type AgendaPatientParams,
} from './agendaApi';
import type { AgendaFilters, AgendaView } from './agendaUtils';
import { fallbackRangeForView } from './agendaUtils';
import { useRealtimeRevision } from '../../contexts/useRealtime';

const EMPTY_APPOINTMENTS: AppointmentListResponse = { data: [] };
const EMPTY_PATIENTS: PatientsListResponse = {
  data: [],
  pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
};
const EMPTY_SLOTS: AvailableSlotsResponse | null = null;
const MOCK_ORGANIZATION: OrganizationCurrentResponse = {
  id: '00000000-0000-4000-8000-000000000010',
  name: 'Demo Easyvet',
  slug: 'demo-easyvet',
  status: 'ACTIVE',
  timezone: 'America/Bogota',
  locale: 'es-CO',
  currencyCode: 'COP',
};

type LoadState<T> = {
  data: T | null;
  loading: boolean;
  error: unknown;
  reload: () => void;
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function useAbortableResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  enabled: boolean,
  dependencies: readonly unknown[],
  mockValue: T | null,
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
    // The dependency list is intentionally supplied by each tenant-aware caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, revision, realtimeRevision, ...dependencies]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return useMemo(() => ({ ...state, reload }), [reload, state]);
}

// Organization timezone is loaded before calendar rendering so FullCalendar never starts in browser time.
export function useAgendaOrganization(): LoadState<OrganizationCurrentResponse> {
  const organizationId = useActiveOrganizationId();
  const enabled = appConfig.dataMode === 'mock' || Boolean(organizationId);
  return useAbortableResource(
    (signal) => agendaApi.currentOrganization(signal),
    enabled,
    [organizationId],
    MOCK_ORGANIZATION,
  );
}

type ReferenceData = {
  locations: LocationResponse[];
};

const EMPTY_REFERENCE_DATA: ReferenceData = { locations: [] };
const EMPTY_MEMBERSHIPS: PaginatedMembershipResponse = {
  data: [],
  page: 1,
  pageSize: 20,
  total: 0,
};

// Reference data is tenant-scoped and loaded together so filters cannot mix organizations.
export function useAgendaReferenceData(): LoadState<ReferenceData> {
  const organizationId = useActiveOrganizationId();
  const enabled = appConfig.dataMode === 'mock' || Boolean(organizationId);
  const loader = useCallback(
    async (signal: AbortSignal): Promise<ReferenceData> => {
      const locations = await agendaApi.listLocations(signal);
      return { locations };
    },
    [],
  );
  return useAbortableResource(
    loader,
    enabled,
    [organizationId],
    EMPTY_REFERENCE_DATA,
  );
}

// Staff lookups stay tenant-scoped and fetch only one searchable page at a time.
export function useAgendaMemberships(search: string, page = 1): LoadState<PaginatedMembershipResponse> {
  const organizationId = useActiveOrganizationId();
  const canReadMemberships = useCan(PERMISSION.MEMBERSHIPS_READ);
  const [debouncedSearch, setDebouncedSearch] = useState(search.trim());

  useEffect(() => {
    const normalized = search.trim();
    if (!normalized) {
      setDebouncedSearch('');
      return;
    }
    const timer = window.setTimeout(() => setDebouncedSearch(normalized), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const params = useMemo<AgendaMembershipParams>(
    () => ({ page, pageSize: 20, search: debouncedSearch }),
    [debouncedSearch, page],
  );
  const loader = useCallback(
    (signal: AbortSignal) => agendaApi.listMemberships({ ...params, signal }),
    [params],
  );
  return useAbortableResource(
    loader,
    (appConfig.dataMode === 'mock' || Boolean(organizationId)) && canReadMemberships,
    [organizationId, canReadMemberships, params.page, params.search],
    EMPTY_MEMBERSHIPS,
  );
}

export function useAgendaAppointments(
  range: { from: string; to: string } | null,
  filters: AgendaFilters,
): LoadState<AppointmentListResponse> {
  const organizationId = useActiveOrganizationId();
  const enabled = appConfig.dataMode === 'mock' || Boolean(organizationId && range);
  const query = useMemo<AgendaListParams | null>(() => {
    if (!range) return null;
    return {
      from: range.from,
      to: range.to,
      ...(filters.clinicLocationId ? { clinicLocationId: filters.clinicLocationId } : {}),
      ...(filters.assignedMembershipId && filters.assignedMembershipId !== 'UNASSIGNED'
        ? { assignedMembershipId: filters.assignedMembershipId }
        : {}),
      ...(filters.patientId ? { patientId: filters.patientId } : {}),
      ...(filters.status !== 'ALL' ? { status: filters.status } : {}),
    };
  }, [filters, range]);
  const loader = useCallback(
    (signal: AbortSignal) =>
      query
        ? agendaApi.listAppointments({ ...query, signal })
        : Promise.resolve(EMPTY_APPOINTMENTS),
    [query],
  );
  return useAbortableResource<AppointmentListResponse>(
    loader,
    enabled,
    [organizationId, query ? JSON.stringify(query) : null],
    EMPTY_APPOINTMENTS,
  );
}

export function useAgendaPatients(search: string): LoadState<PatientsListResponse> {
  const organizationId = useActiveOrganizationId();
  const canReadPatients = useCan(PERMISSION.PATIENTS_READ);
  const params = useMemo<AgendaPatientParams>(() => ({ page: 1, pageSize: 20, search }), [search]);
  const loader = useCallback(
    (signal: AbortSignal) => agendaApi.listPatients({ ...params, signal }),
    [params],
  );
  return useAbortableResource<PatientsListResponse>(
    loader,
    (appConfig.dataMode === 'mock' || Boolean(organizationId)) && canReadPatients,
    [organizationId, canReadPatients, params.search],
    EMPTY_PATIENTS,
  );
}

type AvailableSlotsInput = {
  date: string;
  clinicLocationId: string;
  assignedMembershipId?: string;
  durationMinutes: number;
};

// Slot reads are abortable and tenant-keyed so forms never display availability from another organization.
export function useAgendaAvailableSlots(
  input: AvailableSlotsInput | null,
): LoadState<AvailableSlotsResponse | null> {
  const organizationId = useActiveOrganizationId();
  const [availabilityRevision, setAvailabilityRevision] = useState(0);
  useEffect(() => {
    const handleAvailabilityChanged = () => setAvailabilityRevision((value) => value + 1);
    window.addEventListener('easyvet:availability-changed', handleAvailabilityChanged);
    return () =>
      window.removeEventListener('easyvet:availability-changed', handleAvailabilityChanged);
  }, []);
  const enabled = appConfig.dataMode === 'mock' || Boolean(organizationId && input);
  const loader = useCallback(
    (signal: AbortSignal) =>
      input ? agendaApi.availableSlots({ ...input, signal }) : Promise.resolve(EMPTY_SLOTS),
    [input],
  );
  return useAbortableResource<AvailableSlotsResponse | null>(
    loader,
    enabled,
    [organizationId, input ? JSON.stringify(input) : null, availabilityRevision],
    EMPTY_SLOTS,
  );
}

// Availability mutations broadcast a small local invalidation event so open booking forms
// request fresh slots without introducing a global cache or polling form state.
export function notifyAvailabilityChanged(): void {
  window.dispatchEvent(new Event('easyvet:availability-changed'));
}

export function useAgendaAvailability(): LoadState<AvailabilityRuleResponse[]> {
  const organizationId = useActiveOrganizationId();
  const enabled = appConfig.dataMode === 'mock' || Boolean(organizationId);
  return useAbortableResource<AvailabilityRuleResponse[]>(
    (signal) => agendaApi.listAvailability(signal),
    enabled,
    [organizationId],
    [],
  );
}

export function useAgendaAppointment(
  appointmentId: string | undefined,
): LoadState<AppointmentResponse> {
  const organizationId = useActiveOrganizationId();
  return useAbortableResource<AppointmentResponse>(
    (signal) =>
      appointmentId
        ? agendaApi.findAppointment(appointmentId, signal)
        : Promise.reject(new Error('Cita requerida')),
    Boolean(organizationId && appointmentId) || appConfig.dataMode === 'mock',
    [organizationId, appointmentId],
    null,
  );
}

export function initialAgendaRange(view: AgendaView, date: string, timezone: string) {
  return fallbackRangeForView(view, date, timezone);
}
