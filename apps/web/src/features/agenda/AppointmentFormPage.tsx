import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  type MembershipResponse,
  type AppointmentResponse,
  type CreateAppointmentRequest,
  type RescheduleAppointmentRequest,
  type UpdateAppointmentRequest,
} from '@veterinary-saas/contracts';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { PaginationControls } from '../shared/ResourceFeedback';
import { SearchInput } from '../../components/ui/SearchInput';
import { Select } from '../../components/ui/Select';
import { TextInput } from '../../components/ui/TextInput';
import { ApiError } from '../../services/apiClient';
import { ResourceError } from '../shared/ResourceFeedback';
import { errorMessage } from '../shared/resourceUtils';
import {
  addCivilMinutes,
  civilDateFromDate,
  civilFieldsFromInstant,
  instantFromCivil,
} from './agendaUtils';
import { agendaApi } from './agendaApi';
import {
  useAgendaAppointment,
  useAgendaAvailableSlots,
  useAgendaMemberships,
  useAgendaOrganization,
  useAgendaPatients,
  useAgendaReferenceData,
} from './useAgenda';

type AppointmentFormMode = 'create' | 'edit' | 'reschedule';

type AppointmentFormState = {
  clinicLocationId: string;
  patientId: string;
  assignedMembershipId: string;
  date: string;
  time: string;
  durationMinutes: string;
  reason: string;
  notes: string;
};

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;
const EMPTY_FORM: AppointmentFormState = {
  clinicLocationId: '',
  patientId: '',
  assignedMembershipId: '',
  date: '',
  time: '',
  durationMinutes: '30',
  reason: '',
  notes: '',
};

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function appointmentFormFromRecord(
  appointment: AppointmentResponse,
  timezone: string,
): AppointmentFormState {
  const local = civilFieldsFromInstant(appointment.startsAt, timezone);
  return {
    clinicLocationId: appointment.clinicLocationId,
    patientId: appointment.patientId,
    assignedMembershipId: appointment.assignedMembershipId ?? '',
    date: local.date,
    time: local.time,
    durationMinutes: String(
      Math.round((Date.parse(appointment.endsAt) - Date.parse(appointment.startsAt)) / 60_000),
    ),
    reason: appointment.reason,
    notes: appointment.notes ?? '',
  };
}

function titleFor(mode: AppointmentFormMode): string {
  if (mode === 'create') return 'Nueva cita';
  if (mode === 'edit') return 'Editar cita';
  return 'Reprogramar cita';
}

function descriptionFor(mode: AppointmentFormMode, timezone: string): string {
  if (mode === 'create') {
    return `Programa una cita usando la hora local de ${timezone}. El servidor valida disponibilidad y conflictos.`;
  }
  if (mode === 'edit')
    return 'Actualiza la información permitida sin cambiar el horario de la cita.';
  return `Elige un nuevo horario en ${timezone}. La disponibilidad se consulta nuevamente antes de enviar.`;
}

// Create, edit and reschedule share one narrow form while keeping each backend mutation explicit.
export function AppointmentFormPage({ mode }: { mode: AppointmentFormMode }) {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const organization = useAgendaOrganization();
  const references = useAgendaReferenceData();
  const appointmentState = useAgendaAppointment(mode === 'create' ? undefined : appointmentId);
  const organizationId = organization.data?.id;
  const previousOrganizationRef = useRef(organizationId);
  const initializedRef = useRef(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [professionalSearch, setProfessionalSearch] = useState('');
  const [professionalPage, setProfessionalPage] = useState(1);
  const [selectedMembership, setSelectedMembership] = useState<MembershipResponse | null>(null);
  const patients = useAgendaPatients(patientSearch.trim());
  const memberships = useAgendaMemberships(professionalSearch, professionalPage);
  const [form, setForm] = useState<AppointmentFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    if (previousOrganizationRef.current && previousOrganizationRef.current !== organizationId) {
      setSelectedMembership(null);
      setProfessionalSearch('');
      setProfessionalPage(1);
      setForm(EMPTY_FORM);
      navigate('/agenda', { replace: true });
      return;
    }
    previousOrganizationRef.current = organizationId;
  }, [navigate, organizationId]);

  useEffect(() => {
    if (!organization.data || initializedRef.current) return;
    if (mode !== 'create' && appointmentState.data) {
      setForm(appointmentFormFromRecord(appointmentState.data, organization.data.timezone));
      initializedRef.current = true;
      return;
    }
    if (mode === 'create') {
      const queryDate = searchParams.get('date');
      const queryTime = searchParams.get('time');
      setForm((current) => ({
        ...current,
        date:
          queryDate && isValidDate(queryDate)
            ? queryDate
            : civilDateFromDate(new Date(), organization.data!.timezone),
        time: queryTime && isValidTime(queryTime) ? queryTime : '09:00',
      }));
      initializedRef.current = true;
    }
  }, [appointmentState.data, mode, organization.data, searchParams]);

  useEffect(() => {
    if (!references.data || form.clinicLocationId) return;
    const activeLocations = references.data.locations.filter(
      (location) => location.status === 'ACTIVE',
    );
    const onlyLocation = activeLocations[0];
    if (activeLocations.length === 1 && onlyLocation) {
      setForm((current) => ({ ...current, clinicLocationId: onlyLocation.id }));
    }
  }, [form.clinicLocationId, references.data]);

  const activeLocations = useMemo(
    () => references.data?.locations.filter((location) => location.status === 'ACTIVE') ?? [],
    [references.data],
  );
  const activeMemberships = useMemo(() => {
    const options = memberships.data?.data ?? [];
    const currentAppointmentMembership = appointmentState.data?.assignedMembership;
    const fallback: MembershipResponse | null =
      selectedMembership ??
      (currentAppointmentMembership
        ? {
            id: currentAppointmentMembership.id,
            role: currentAppointmentMembership.role,
            clinicalRole: null,
            status: 'ACTIVE',
            user: { email: currentAppointmentMembership.user.email, displayName: null },
            professionalProfileConfigured: false,
          }
        : null);
    return [
      ...options,
      ...(fallback && !options.some(({ id }) => id === fallback.id) ? [fallback] : []),
    ].filter((membership) => membership.status === 'ACTIVE');
  }, [appointmentState.data?.assignedMembership, memberships.data, selectedMembership]);
  const patientOptions = useMemo(
    () => patients.data?.data.filter((patient) => patient.status === 'ACTIVE') ?? [],
    [patients.data],
  );
  const selectedPatient = patientOptions.find((patient) => patient.id === form.patientId);
  const currentAppointment = appointmentState.data;
  const ownerName = selectedPatient
    ? [selectedPatient.owner.firstName, selectedPatient.owner.lastName].filter(Boolean).join(' ')
    : currentAppointment
      ? [currentAppointment.owner.firstName, currentAppointment.owner.lastName]
          .filter(Boolean)
          .join(' ')
      : '';
  const slotInput = useMemo(() => {
    if (mode === 'edit' || !form.clinicLocationId || !isValidDate(form.date)) return null;
    return {
      date: form.date,
      clinicLocationId: form.clinicLocationId,
      ...(form.assignedMembershipId ? { assignedMembershipId: form.assignedMembershipId } : {}),
      durationMinutes: Number(form.durationMinutes),
    };
  }, [form.assignedMembershipId, form.clinicLocationId, form.date, form.durationMinutes, mode]);
  const slots = useAgendaAvailableSlots(slotInput);

  if (organization.error) {
    return (
      <div className="page-stack agenda-form-page">
        <PageHeader
          eyebrow="Agenda · Programación"
          title={titleFor(mode)}
          description={descriptionFor(mode, organization.data?.timezone ?? 'zona local')}
        />
        <ResourceError error={organization.error} onRetry={organization.reload} />
      </div>
    );
  }
  if (references.error) {
    return (
      <div className="page-stack agenda-form-page">
        <PageHeader
          eyebrow="Agenda · Programación"
          title={titleFor(mode)}
          description={descriptionFor(mode, organization.data?.timezone ?? 'zona local')}
        />
        <ResourceError error={references.error} onRetry={references.reload} />
      </div>
    );
  }
  if (organization.loading || !organization.data || references.loading) {
    return (
      <Card className="resource-card">
        <LoadingState label="Cargando contexto de Agenda" />
      </Card>
    );
  }
  if (mode !== 'create' && appointmentState.loading) {
    return (
      <Card className="resource-card">
        <LoadingState label="Cargando cita" />
      </Card>
    );
  }
  if (mode !== 'create' && appointmentState.error) {
    return (
      <div className="page-stack agenda-form-page">
        <PageHeader
          eyebrow="Agenda · Programación"
          title={titleFor(mode)}
          description={descriptionFor(mode, organization.data.timezone)}
        />
        <ResourceError error={appointmentState.error} onRetry={appointmentState.reload} />
      </div>
    );
  }
  if (mode !== 'create' && !currentAppointment) {
    return (
      <Card className="resource-card">
        <Alert tone="error" role="alert">
          La cita no está disponible en esta organización.
        </Alert>
      </Card>
    );
  }

  const update = (field: keyof AppointmentFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
    setServerError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (mode === 'create') {
      if (!form.clinicLocationId) nextErrors.clinicLocationId = 'Selecciona una sede.';
      if (!form.patientId || !selectedPatient)
        nextErrors.patientId = 'Selecciona un Patient activo.';
      if (!ownerName) nextErrors.ownerId = 'El Patient debe tener un Owner activo.';
    }
    if (mode !== 'edit') {
      if (!isValidDate(form.date)) nextErrors.date = 'Indica una fecha válida.';
      if (!isValidTime(form.time)) nextErrors.time = 'Indica una hora válida.';
    }
    if (mode !== 'reschedule' && !form.reason.trim())
      nextErrors.reason = 'Indica el motivo de la cita.';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    let startsAt: string | undefined;
    let endsAt: string | undefined;
    if (mode !== 'edit') {
      try {
        const endCivil = addCivilMinutes(form.date, form.time, Number(form.durationMinutes));
        if (endCivil.date !== form.date) {
          setErrors((current) => ({ ...current, time: 'La cita no puede cruzar el día local.' }));
          return;
        }
        startsAt = instantFromCivil(form.date, form.time, organization.data!.timezone);
        endsAt = instantFromCivil(endCivil.date, endCivil.time, organization.data!.timezone);
      } catch {
        setErrors((current) => ({
          ...current,
          time: 'La hora no es válida en la zona horaria de la organización.',
        }));
        return;
      }
    }
    setSaving(true);
    setServerError(null);
    try {
      let saved: AppointmentResponse;
      if (mode === 'create') {
        const payload: CreateAppointmentRequest = {
          clinicLocationId: form.clinicLocationId,
          patientId: form.patientId,
          ownerId: selectedPatient!.ownerId,
          assignedMembershipId: form.assignedMembershipId || null,
          startsAt: startsAt!,
          endsAt: endsAt!,
          reason: form.reason,
          notes: nullable(form.notes),
        };
        saved = await agendaApi.createAppointment(payload);
      } else if (mode === 'edit') {
        const payload: UpdateAppointmentRequest = {
          reason: form.reason,
          notes: nullable(form.notes),
          assignedMembershipId: form.assignedMembershipId || null,
        };
        saved = await agendaApi.updateAppointment(appointmentId!, payload);
      } else {
        const payload: RescheduleAppointmentRequest = { startsAt: startsAt!, endsAt: endsAt! };
        saved = await agendaApi.rescheduleAppointment(appointmentId!, payload);
      }
      navigate(`/agenda/citas/${saved.id}?view=day&date=${form.date}`);
    } catch (requestError: unknown) {
      setServerError(requestError);
      if (requestError instanceof ApiError && requestError.status === 409) slots.reload();
    } finally {
      setSaving(false);
    }
  };

  const isTerminal = Boolean(
    currentAppointment && ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(currentAppointment.status),
  );
  const isRescheduleInvalid = Boolean(
    currentAppointment && currentAppointment.status !== 'SCHEDULED',
  );
  if (isTerminal || (mode === 'reschedule' && isRescheduleInvalid)) {
    return (
      <div className="page-stack">
        <PageHeader
          eyebrow="Agenda"
          title={titleFor(mode)}
          description="Esta cita no permite la operación solicitada por su estado actual."
        />
        <Card className="resource-card">
          <Alert tone="error" role="alert">
            La cita no puede modificarse en su estado actual.
          </Alert>
        </Card>
      </div>
    );
  }

  const showPatientFields = mode === 'create';
  const slotItems = slots.data?.slots ?? [];
  return (
    <div className="page-stack agenda-form-page">
      <PageHeader
        eyebrow="Agenda · Programación"
        title={titleFor(mode)}
        description={descriptionFor(mode, organization.data.timezone)}
      />
      <Card className="form-card">
        <form className="domain-form" onSubmit={(event) => void submit(event)} noValidate>
          {serverError ? (
            <Alert tone="error" role="alert">
              {serverError instanceof ApiError && serverError.status === 409
                ? 'El horario ya no está disponible. Selecciona otro horario.'
                : errorMessage(serverError, 'No fue posible guardar la cita.')}
            </Alert>
          ) : null}
          {mode === 'reschedule' && currentAppointment ? (
            <div className="form-section appointment-current-summary">
              <div>
                <p className="section-kicker">Horario actual</p>
                <h2>{currentAppointment.patient.name}</h2>
              </div>
              <p>
                {
                  civilFieldsFromInstant(currentAppointment.startsAt, organization.data.timezone)
                    .date
                }{' '}
                ·{' '}
                {
                  civilFieldsFromInstant(currentAppointment.startsAt, organization.data.timezone)
                    .time
                }{' '}
                · {currentAppointment.reason}
              </p>
            </div>
          ) : null}
          {showPatientFields ? (
            <>
              <div className="form-section">
                <div>
                  <p className="section-kicker">Contexto clínico</p>
                  <h2>¿Para quién es la cita?</h2>
                </div>
                <p>Solo se pueden elegir Patients activos de la organización actual.</p>
              </div>
              <div className="form-grid form-grid--two">
                <FormField
                  label="Buscar Patient"
                  htmlFor="appointment-patient-search"
                  hint="La búsqueda es paginada; no se descarga todo el catálogo."
                >
                  <TextInput
                    id="appointment-patient-search"
                    value={patientSearch}
                    onChange={(event) => setPatientSearch(event.target.value)}
                    placeholder="Nombre del Patient"
                  />
                </FormField>
                <FormField label="Patient *" htmlFor="appointment-patient">
                  <Select
                    id="appointment-patient"
                    value={form.patientId}
                    onChange={(event) => update('patientId', event.target.value)}
                    aria-invalid={Boolean(errors.patientId)}
                  >
                    <option value="">Selecciona un Patient</option>
                    {patientOptions.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.name} · {patient.species}
                        {patient.breed ? ` · ${patient.breed}` : ''}
                      </option>
                    ))}
                  </Select>
                  {errors.patientId ? (
                    <span className="field-error" role="alert">
                      {errors.patientId}
                    </span>
                  ) : null}
                </FormField>
                <FormField label="Owner derivado" htmlFor="appointment-owner">
                  <TextInput
                    id="appointment-owner"
                    value={ownerName || 'Selecciona un Patient'}
                    readOnly
                    aria-invalid={Boolean(errors.ownerId)}
                  />
                  {errors.ownerId ? (
                    <span className="field-error" role="alert">
                      {errors.ownerId}
                    </span>
                  ) : null}
                </FormField>
              </div>
            </>
          ) : currentAppointment ? (
            <div className="form-section appointment-current-summary">
              <div>
                <p className="section-kicker">Patient y Owner</p>
                <h2>{currentAppointment.patient.name}</h2>
              </div>
              <p>
                {[currentAppointment.owner.firstName, currentAppointment.owner.lastName]
                  .filter(Boolean)
                  .join(' ')}
              </p>
            </div>
          ) : null}
          <div className="form-section">
            <div>
              <p className="section-kicker">Programación</p>
              <h2>Sede y profesional</h2>
            </div>
            <p>La sede es obligatoria; el profesional puede quedar sin asignar.</p>
          </div>
          <div className="form-grid form-grid--two">
            <FormField label="Sede *" htmlFor="appointment-location">
              <Select
                id="appointment-location"
                value={form.clinicLocationId}
                disabled={mode !== 'create'}
                onChange={(event) => update('clinicLocationId', event.target.value)}
                aria-invalid={Boolean(errors.clinicLocationId)}
              >
                <option value="">Selecciona una sede</option>
                {activeLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                    {location.city ? ` · ${location.city}` : ''}
                  </option>
                ))}
              </Select>
              {errors.clinicLocationId ? (
                <span className="field-error" role="alert">
                  {errors.clinicLocationId}
                </span>
              ) : null}
            </FormField>
            <FormField label="Buscar profesional" htmlFor="appointment-professional-search">
              <SearchInput
                id="appointment-professional-search"
                value={professionalSearch}
                onChange={(value) => {
                  setProfessionalSearch(value);
                  setProfessionalPage(1);
                }}
                placeholder="Nombre o correo del profesional"
              />
            </FormField>
            <FormField label="Profesional" htmlFor="appointment-professional">
              <Select
                id="appointment-professional"
                value={form.assignedMembershipId}
                disabled={mode === 'reschedule'}
                onChange={(event) => {
                  const membershipId = event.target.value;
                  setSelectedMembership(
                    memberships.data?.data.find(({ id }) => id === membershipId) ?? null,
                  );
                  update('assignedMembershipId', membershipId);
                }}
              >
                <option value="">Sin profesional asignado</option>
                {activeMemberships.map((membership) => (
                  <option key={membership.id} value={membership.id}>
                    {membership.user.email} · {membership.role}
                  </option>
                ))}
              </Select>
              <p role="status" aria-live="polite">
                {memberships.loading
                  ? 'Buscando profesionales…'
                  : `${memberships.data?.total ?? 0} profesionales activos`}
              </p>
              {memberships.error ? (
                <div role="alert">
                  <p>No fue posible cargar profesionales.</p>
                  <Button variant="secondary" type="button" onClick={memberships.reload}>
                    Reintentar carga de profesionales
                  </Button>
                </div>
              ) : null}
              <PaginationControls
                page={memberships.data?.page ?? 1}
                totalPages={Math.ceil(
                  (memberships.data?.total ?? 0) / (memberships.data?.pageSize ?? 20),
                )}
                onChange={setProfessionalPage}
                ariaLabel="Paginación de profesionales"
              />
            </FormField>
          </div>
          {mode !== 'edit' ? (
            <>
              <div className="form-section">
                <div>
                  <p className="section-kicker">Horario local</p>
                  <h2>Fecha, hora y duración</h2>
                </div>
                <p>Zona horaria de la organización: {organization.data.timezone}.</p>
              </div>
              <div className="form-grid form-grid--three">
                <FormField label="Fecha *" htmlFor="appointment-date">
                  <TextInput
                    id="appointment-date"
                    type="date"
                    value={form.date}
                    onChange={(event) => update('date', event.target.value)}
                    aria-invalid={Boolean(errors.date)}
                  />
                  {errors.date ? (
                    <span className="field-error" role="alert">
                      {errors.date}
                    </span>
                  ) : null}
                </FormField>
                <FormField label="Hora *" htmlFor="appointment-time">
                  <TextInput
                    id="appointment-time"
                    type="time"
                    value={form.time}
                    onChange={(event) => update('time', event.target.value)}
                    aria-invalid={Boolean(errors.time)}
                  />
                  {errors.time ? (
                    <span className="field-error" role="alert">
                      {errors.time}
                    </span>
                  ) : null}
                </FormField>
                <FormField label="Duración" htmlFor="appointment-duration">
                  <Select
                    id="appointment-duration"
                    value={form.durationMinutes}
                    onChange={(event) => update('durationMinutes', event.target.value)}
                  >
                    {DURATION_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} minutos
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
              {slots.loading ? (
                <p className="form-field__hint" role="status">
                  Consultando horarios disponibles…
                </p>
              ) : null}
              {slots.error ? (
                <p className="field-error" role="alert">
                  No fue posible consultar horarios; puedes intentar nuevamente.
                </p>
              ) : null}
              {slots.data?.mode === 'UNRESTRICTED' ? (
                <p className="availability-note">
                  Sin horario configurado — selecciona una hora. El servidor validará conflictos.
                </p>
              ) : null}
              {slots.data?.mode === 'RULES' ? (
                <div className="slot-picker" aria-label="Horarios disponibles">
                  <span className="form-field__hint">Horarios disponibles</span>
                  {slotItems.length ? (
                    slotItems.map((slot) => {
                      const local = civilFieldsFromInstant(
                        slot.startsAt,
                        organization.data!.timezone,
                      );
                      return (
                        <button
                          key={slot.startsAt}
                          type="button"
                          className={
                            form.time === local.time
                              ? 'slot-picker__slot is-selected'
                              : 'slot-picker__slot'
                          }
                          onClick={() => update('time', local.time)}
                        >
                          {local.time}
                        </button>
                      );
                    })
                  ) : (
                    <p className="form-field__hint">
                      No hay slots disponibles para estos criterios.
                    </p>
                  )}
                </div>
              ) : null}
            </>
          ) : null}
          {mode !== 'reschedule' ? (
            <>
              <FormField label="Motivo *" htmlFor="appointment-reason">
                <TextInput
                  id="appointment-reason"
                  value={form.reason}
                  onChange={(event) => update('reason', event.target.value)}
                  aria-invalid={Boolean(errors.reason)}
                />
                {errors.reason ? (
                  <span className="field-error" role="alert">
                    {errors.reason}
                  </span>
                ) : null}
              </FormField>
              <FormField label="Notas" htmlFor="appointment-notes">
                <textarea
                  id="appointment-notes"
                  className="input input--textarea"
                  value={form.notes}
                  onChange={(event) => update('notes', event.target.value)}
                />
              </FormField>
            </>
          ) : null}
          <div className="form-actions">
            <Button
              as={Link}
              to={mode === 'create' ? '/agenda' : `/agenda/citas/${appointmentId}`}
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? 'Guardando…'
                : mode === 'create'
                  ? 'Crear cita'
                  : mode === 'edit'
                    ? 'Guardar cambios'
                    : 'Reprogramar cita'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
