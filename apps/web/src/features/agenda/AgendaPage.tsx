import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { ResourceError } from '../shared/ResourceFeedback';
import { useAuth } from '../../contexts/useAuth';
import { Temporal } from 'temporal-polyfill';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { AgendaCalendar } from './AgendaCalendar';
import { AgendaFilters } from './AgendaFilters';
import { AppointmentDetail } from './AppointmentDetail';
import { AgendaWorkflowSummary } from './AgendaWorkflowSummary';
import {
  appointmentToCalendarEvent,
  civilDateFromDate,
  isAgendaView,
  type AgendaFilters as AgendaFilterValues,
  type AgendaView,
} from './agendaUtils';
import {
  initialAgendaRange,
  useAgendaAppointments,
  useAgendaOrganization,
  useAgendaPatients,
  useAgendaReferenceData,
} from './useAgenda';

const DEFAULT_FILTERS: AgendaFilterValues = {
  clinicLocationId: '',
  assignedMembershipId: '',
  patientId: '',
  status: 'ALL',
};

function validCivilDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function rangeWithOffset(range: { from: string; to: string }, timezone: string) {
  const normalize = (value: string) => {
    if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) return value;
    const plain = Temporal.PlainDateTime.from(value.replace(' ', 'T'));
    return plain.toZonedDateTime(timezone).toInstant().toString();
  };
  return { from: normalize(range.from), to: normalize(range.to) };
}

// AgendaPage owns URL state, tenant resets and the calendar/detail orchestration.
export function AgendaPage() {
  const canRead = useCan(PERMISSION.APPOINTMENTS_READ);
  const canCreate = useCan(PERMISSION.APPOINTMENTS_CREATE);
  const { activeMembership } = useAuth();
  const organizationId = activeMembership?.organization.id;
  const organization = useAgendaOrganization();
  const referenceData = useAgendaReferenceData();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { appointmentId } = useParams<{ appointmentId?: string }>();
  const timezone = organization.data?.timezone ?? 'UTC';
  const view = isAgendaView(searchParams.get('view'))
    ? (searchParams.get('view') as AgendaView)
    : 'month';
  const date = validCivilDate(searchParams.get('date'))
    ? (searchParams.get('date') as string)
    : civilDateFromDate(new Date(), timezone);
  const [filters, setFilters] = useState<AgendaFilterValues>(DEFAULT_FILTERS);
  const [patientSearch, setPatientSearch] = useState('');
  const [debouncedPatientSearch, setDebouncedPatientSearch] = useState('');
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const previousOrganizationRef = useRef(organizationId);

  const updateQuery = useCallback(
    (values: { view?: AgendaView; date?: string; appointment?: string | null }) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (values.view) next.set('view', values.view);
          if (values.date) next.set('date', values.date);
          if (values.appointment === null) next.delete('appointment');
          if (values.appointment) next.set('appointment', values.appointment);
          // Avoid a duplicate history entry when FullCalendar reports its
          // already-selected range during initialisation.
          return next.toString() === current.toString() ? current : next;
        },
        // Calendar navigation is user-visible state and must support Back/Forward.
        { replace: false },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedPatientSearch(patientSearch.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [patientSearch]);

  useEffect(() => {
    if (organizationId === previousOrganizationRef.current) return;
    previousOrganizationRef.current = organizationId;
    setFilters(DEFAULT_FILTERS);
    setPatientSearch('');
    setDebouncedPatientSearch('');
    setRange(null);
    if (appointmentId) {
      const next = new URLSearchParams(searchParams);
      next.delete('appointment');
      navigate(`/agenda?${next.toString()}`, { replace: true });
    }
  }, [appointmentId, navigate, organizationId, searchParams]);

  useEffect(() => {
    if (organization.data) setRange(initialAgendaRange(view, date, organization.data.timezone));
  }, [date, organization.data, view]);

  const appointments = useAgendaAppointments(
    range ? rangeWithOffset(range, timezone) : null,
    filters,
  );
  const patients = useAgendaPatients(debouncedPatientSearch);
  const reloadAppointments = appointments.reload;

  // Day/List views refresh every 45 seconds for shared reception workflows without polling forms.
  useEffect(() => {
    if (view !== 'day' && view !== 'list') return undefined;
    const timer = window.setInterval(() => reloadAppointments(), 45_000);
    return () => window.clearInterval(timer);
  }, [reloadAppointments, view]);

  const allAppointments = useMemo(() => appointments.data?.data ?? [], [appointments.data?.data]);
  const visibleAppointments = useMemo(
    () =>
      filters.assignedMembershipId === 'UNASSIGNED'
        ? allAppointments.filter((appointment) => appointment.assignedMembershipId === null)
        : allAppointments,
    [allAppointments, filters.assignedMembershipId],
  );
  const events = useMemo(
    () => visibleAppointments.map(appointmentToCalendarEvent),
    [visibleAppointments],
  );

  const handleRangeChange = useCallback(
    (nextRange: { from: string; to: string }, nextView: AgendaView, nextDate: string) => {
      setRange(rangeWithOffset(nextRange, timezone));
      updateQuery({ view: nextView, date: nextDate });
    },
    [timezone, updateQuery],
  );

  const openAppointment = useCallback(
    (id: string) => {
      navigate(`/agenda/citas/${id}${location.search}`);
    },
    [location.search, navigate],
  );

  const closeDetail = useCallback(() => {
    navigate(`/agenda${location.search}`);
  }, [location.search, navigate]);

  const handleViewChange = useCallback(
    (nextView: AgendaView) => updateQuery({ view: nextView }),
    [updateQuery],
  );

  if (!canRead) {
    return null;
  }

  if (organization.loading || !organization.data) {
    return (
      <div className="page-stack agenda-page">
        <PageHeader
          eyebrow="Agenda"
          title="Agenda clínica"
          description="Cargando la zona horaria de tu organización…"
        />
        <Card className="agenda-card">
          <LoadingState label="Cargando agenda" />
        </Card>
      </div>
    );
  }

  const currentOrganization = organization.data;

  return (
    <div className="page-stack agenda-page">
      <PageHeader
        eyebrow="Agenda · Programación"
        title="Agenda clínica"
        description={`Citas de ${currentOrganization.name} mostradas en ${currentOrganization.timezone}.`}
        action={
          <div className="agenda-header-actions">
            <Badge tone="info">{`${visibleAppointments.length} visibles`}</Badge>
            {canCreate ? (
              <Button as={Link} to="/agenda/nueva">
                Nueva cita
              </Button>
            ) : null}
          </div>
        }
      />
      <Card className="agenda-card agenda-card--filters">
        <AgendaFilters
          filters={filters}
          locations={referenceData.data?.locations ?? []}
          memberships={referenceData.data?.memberships ?? []}
          patients={patients.data?.data ?? []}
          patientSearch={patientSearch}
          observedAppointments={allAppointments}
          onChange={setFilters}
          onPatientSearchChange={setPatientSearch}
          onReset={() => {
            setFilters(DEFAULT_FILTERS);
            setPatientSearch('');
          }}
        />
        {referenceData.error ? (
          <p className="agenda-inline-warning">
            No fue posible cargar todos los filtros de referencia. La agenda continúa disponible.
          </p>
        ) : null}
      </Card>
      {view === 'day' || view === 'list' ? (
        <Card className="agenda-card agenda-card--workflow">
          <AgendaWorkflowSummary
            appointments={allAppointments}
            selectedStatus={filters.status}
            onStatusChange={(status) => setFilters((current) => ({ ...current, status }))}
          />
        </Card>
      ) : null}
      {appointments.error ? (
        <Card className="agenda-card">
          <ResourceError error={appointments.error} onRetry={appointments.reload} />
        </Card>
      ) : (
        <AgendaCalendar
          key={currentOrganization.id}
          view={view}
          date={date}
          timezone={currentOrganization.timezone}
          events={events}
          loading={appointments.loading}
          onRangeChange={handleRangeChange}
          onOpenAppointment={openAppointment}
          onViewChange={handleViewChange}
        />
      )}
      {!appointments.loading && !appointments.error && events.length === 0 ? (
        <Card className="agenda-card agenda-empty-card">
          <EmptyState
            icon="◷"
            title="No hay citas para este período"
            description="Prueba otro rango o ajusta los filtros de la agenda."
          />
        </Card>
      ) : null}
      <AppointmentDetail
        appointmentId={appointmentId}
        timezone={currentOrganization.timezone}
        onClose={closeDetail}
        onChanged={appointments.reload}
      />
    </div>
  );
}
