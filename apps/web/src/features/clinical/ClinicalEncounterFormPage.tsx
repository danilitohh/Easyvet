import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  createClinicalEncounterRequestSchema,
  updateClinicalEncounterRequestSchema,
  type AppointmentResponse,
  type ClinicalEncounterResponse,
  type CreateClinicalEncounterRequest,
  type UpdateClinicalEncounterRequest,
} from '@veterinary-saas/contracts';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { TextInput } from '../../components/ui/TextInput';
import { ApiError } from '../../services/apiClient';
import { useActiveOrganizationId } from '../shared/hooks';
import { ResourceError } from '../shared/ResourceFeedback';
import { errorMessage } from '../shared/resourceUtils';
import { agendaApi } from '../agenda/agendaApi';
import { civilFieldsFromInstant, instantFromCivil } from '../agenda/agendaUtils';
import { usePatient } from '../patients/usePatients';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { useAuth } from '../../contexts/useAuth';
import { clinicalApi } from './clinicalApi';
import {
  useClinicalEncounter,
  useClinicalOrganization,
  useClinicalPractitioners,
} from './useClinical';

type EncounterFormState = {
  occurredAt: string;
  clinicLocationId: string;
  appointmentId: string;
  responsibleMembershipId: string;
  reason: string;
  anamnesis: string;
  physicalExam: string;
  presumptiveDiagnosis: string;
  differentialDiagnosis: string;
  definitiveDiagnosis: string;
  diagnosticPlan: string;
  therapeuticPlan: string;
  recommendations: string;
  followUpPlan: string;
  notes: string;
};

const EMPTY_FORM: EncounterFormState = {
  occurredAt: '',
  clinicLocationId: '',
  appointmentId: '',
  responsibleMembershipId: '',
  reason: '',
  anamnesis: '',
  physicalExam: '',
  presumptiveDiagnosis: '',
  differentialDiagnosis: '',
  definitiveDiagnosis: '',
  diagnosticPlan: '',
  therapeuticPlan: '',
  recommendations: '',
  followUpPlan: '',
  notes: '',
};

const NARRATIVE_FIELDS: Array<[keyof EncounterFormState, string]> = [
  ['anamnesis', 'Anamnesis'],
  ['physicalExam', 'Examen físico'],
  ['presumptiveDiagnosis', 'Diagnóstico presuntivo'],
  ['differentialDiagnosis', 'Diagnóstico diferencial'],
  ['definitiveDiagnosis', 'Diagnóstico definitivo'],
  ['diagnosticPlan', 'Plan diagnóstico'],
  ['therapeuticPlan', 'Plan terapéutico'],
  ['recommendations', 'Recomendaciones'],
  ['followUpPlan', 'Seguimiento'],
  ['notes', 'Notas'],
];

function toNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function fieldErrors(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues.reduce<Record<string, string>>((result, issue) => {
    const key = issue.path[0];
    if (typeof key === 'string' && !result[key]) result[key] = issue.message;
    return result;
  }, {});
}

function formFromEncounter(
  encounter: ClinicalEncounterResponse,
  timezone: string,
): EncounterFormState {
  const occurredAt = civilFieldsFromInstant(encounter.occurredAt, timezone);
  return {
    occurredAt: `${occurredAt.date}T${occurredAt.time}`,
    clinicLocationId: encounter.clinicLocationId,
    appointmentId: encounter.appointmentId ?? '',
    responsibleMembershipId: encounter.responsibleMembershipId ?? '',
    reason: encounter.reason,
    anamnesis: encounter.anamnesis ?? '',
    physicalExam: encounter.physicalExam ?? '',
    presumptiveDiagnosis: encounter.presumptiveDiagnosis ?? '',
    differentialDiagnosis: encounter.differentialDiagnosis ?? '',
    definitiveDiagnosis: encounter.definitiveDiagnosis ?? '',
    diagnosticPlan: encounter.diagnosticPlan ?? '',
    therapeuticPlan: encounter.therapeuticPlan ?? '',
    recommendations: encounter.recommendations ?? '',
    followUpPlan: encounter.followUpPlan ?? '',
    notes: encounter.notes ?? '',
  };
}

function formPayload(form: EncounterFormState, timezone: string) {
  const [date, time] = form.occurredAt.split('T');
  return {
    clinicLocationId: form.clinicLocationId,
    appointmentId: form.appointmentId || null,
    responsibleMembershipId: form.responsibleMembershipId || null,
    occurredAt: instantFromCivil(date ?? '', time ?? '', timezone),
    reason: form.reason,
    ...Object.fromEntries(
      NARRATIVE_FIELDS.map(([field]) => [field, toNullable(form[field] as string)]),
    ),
  };
}

function AppointmentOption({
  appointment,
  timezone,
}: {
  appointment: AppointmentResponse;
  timezone: string;
}) {
  return (
    <option value={appointment.id}>
      {new Intl.DateTimeFormat('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: timezone,
      }).format(new Date(appointment.startsAt))}{' '}
      · {appointment.reason}
    </option>
  );
}

// Draft form owns only editable encounter fields and sends explicit organization-local instants.
export function ClinicalEncounterFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { patientId, encounterId } = useParams<{ patientId: string; encounterId: string }>();
  const navigate = useNavigate();
  const organizationId = useActiveOrganizationId();
  const { activeMembership } = useAuth();
  const canCreate = useCan(PERMISSION.CLINICAL_ENCOUNTERS_CREATE);
  const canUpdate = useCan(PERMISSION.CLINICAL_ENCOUNTERS_UPDATE_DRAFT);
  const organization = useClinicalOrganization();
  const patient = usePatient(patientId);
  const encounter = useClinicalEncounter(encounterId, mode === 'edit' && canUpdate);
  const practitioners = useClinicalPractitioners(mode === 'create' ? canCreate : canUpdate);
  const [locations, setLocations] = useState<Array<{ id: string; name: string; status: string }>>(
    [],
  );
  const [appointments, setAppointments] = useState<AppointmentResponse[]>([]);
  const [form, setForm] = useState<EncounterFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [initialSignature, setInitialSignature] = useState('');

  useEffect(() => {
    if (!organizationId || !organization.data) return;
    const controller = new AbortController();
    setLocations([]);
    setAppointments([]);
    void Promise.allSettled([
      agendaApi.listLocations(controller.signal),
      agendaApi.listAppointments({
        // Agenda limits a query to ninety days; keep the clinical picker within that contract.
        from: new Date(Date.now() - 30 * 86400000).toISOString(),
        to: new Date(Date.now() + 30 * 86400000).toISOString(),
        patientId,
        signal: controller.signal,
      }),
    ])
      .then(([locationResult, appointmentResult]) => {
        if (controller.signal.aborted) return;
        if (locationResult.status === 'fulfilled') {
          setLocations(locationResult.value.filter((location) => location.status === 'ACTIVE'));
        }
        setAppointments(
          appointmentResult.status === 'fulfilled'
            ? appointmentResult.value.data.filter(
                (item) => item.status !== 'CANCELLED' && item.status !== 'NO_SHOW',
              )
            : [],
        );
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [organizationId, organization.data, patientId]);

  useEffect(() => {
    setInitialized(false);
    setInitialSignature('');
    setForm(EMPTY_FORM);
    setErrors({});
    setServerError(null);
    if (mode === 'create' && organization.data) {
      const fields = civilFieldsFromInstant(new Date().toISOString(), organization.data.timezone);
      const initialForm = {
        ...EMPTY_FORM,
        occurredAt: `${fields.date}T${fields.time}`,
        // Only a clinical PRACTITIONER membership can be the default responsible professional.
        responsibleMembershipId:
          activeMembership?.clinicalRole === 'PRACTITIONER' ? activeMembership.id : '',
      };
      setForm(initialForm);
      setInitialSignature(JSON.stringify(initialForm));
      setInitialized(true);
    }
  }, [mode, organizationId, organization.data, activeMembership]);

  useEffect(() => {
    if (mode === 'edit' && encounter.data && organization.data) {
      const initialForm = formFromEncounter(encounter.data, organization.data.timezone);
      setForm(initialForm);
      setInitialSignature(JSON.stringify(initialForm));
      setInitialized(true);
    }
  }, [mode, encounter.data, organization.data]);

  const selectedAppointment = useMemo(
    () => appointments.find((appointment) => appointment.id === form.appointmentId),
    [appointments, form.appointmentId],
  );
  const dirty = initialized && JSON.stringify(form) !== initialSignature;
  const loading = organization.loading || patient.loading || (mode === 'edit' && encounter.loading);

  if (!patientId) return <ResourceError error={new ApiError('Paciente no encontrado', 404)} />;
  const requiredPatientId = patientId;
  const formTitle = mode === 'create' ? 'Nueva consulta' : 'Editar consulta';
  const formDescription =
    mode === 'create'
      ? 'Prepara un borrador clínico para el paciente seleccionado.'
      : 'Actualiza únicamente los campos permitidos del borrador clínico.';
  if (loading)
    return (
      <div className="page-stack clinical-page">
        <PageHeader eyebrow="Historia clínica" title={formTitle} description={formDescription} />
        <LoadingState label={mode === 'create' ? 'Preparando borrador' : 'Cargando borrador'} />
      </div>
    );
  if (organization.error || patient.error || (mode === 'edit' && encounter.error)) {
    const resourceError = organization.error ?? patient.error ?? encounter.error;
    const reload = organization.error
      ? organization.reload
      : patient.error
        ? patient.reload
        : encounter.reload;
    return (
      <div className="page-stack clinical-page">
        <PageHeader eyebrow="Historia clínica" title={formTitle} description={formDescription} />
        <ResourceError error={resourceError} onRetry={reload} />
      </div>
    );
  }
  if (!patient.patient)
    return <ResourceError error={new ApiError('Paciente no encontrado', 404)} />;
  if (mode === 'create' && patient.patient.status !== 'ACTIVE') {
    return (
      <ResourceError error={new ApiError('El paciente está archivado', 409, 'RESOURCE_ARCHIVED')} />
    );
  }
  if (mode === 'edit' && (!encounter.data || encounter.data.patientId !== patientId)) {
    return (
      <ResourceError error={new ApiError('Encuentro no encontrado', 404, 'RESOURCE_NOT_FOUND')} />
    );
  }
  if (mode === 'edit' && encounter.data?.status !== 'DRAFT') {
    return (
      <Card className="resource-feedback-card">
        <Alert tone="warning" role="status">
          Este encuentro ya no está en borrador y no puede editarse.
        </Alert>
        <Button
          as={Link}
          to={`/pacientes/${patientId}/historia/encuentros/${encounterId}`}
          variant="secondary"
        >
          Ver encuentro
        </Button>
      </Card>
    );
  }

  function update(field: keyof EncounterFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
    setServerError(null);
  }

  function goBack() {
    if (!dirty || window.confirm('Hay cambios sin guardar. ¿Deseas salir?')) {
      navigate(`/pacientes/${patientId}/historia`);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization.data) return;
    let payload: ReturnType<typeof formPayload>;
    try {
      payload = formPayload(form, organization.data.timezone);
    } catch {
      setServerError(
        new ApiError('La fecha no es válida en la zona horaria de la organización.', 400),
      );
      return;
    }
    const parsed =
      mode === 'create'
        ? createClinicalEncounterRequestSchema.safeParse(payload)
        : updateClinicalEncounterRequestSchema.safeParse({
            ...payload,
            expectedVersion: encounter.data?.version,
          });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      const saved =
        mode === 'create'
          ? await clinicalApi.createEncounter(
              requiredPatientId,
              parsed.data as CreateClinicalEncounterRequest,
            )
          : await clinicalApi.updateEncounter(
              encounterId ?? '',
              parsed.data as UpdateClinicalEncounterRequest,
            );
      navigate(`/pacientes/${patientId}/historia/encuentros/${saved.id}`);
    } catch (error: unknown) {
      setServerError(error);
      if (error instanceof ApiError && error.code === 'CLINICAL_ENCOUNTER_IMMUTABLE') {
        // A lifecycle transition won the race; leave the editor and show the authoritative read-only view.
        void clinicalApi
          .findEncounter(encounterId ?? '')
          .then(() =>
            navigate(`/pacientes/${requiredPatientId}/historia/encuentros/${encounterId}`),
          )
          .catch(() => encounter.reload());
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack clinical-page">
      <PageHeader
        eyebrow="Historia clínica"
        title={mode === 'create' ? 'Nueva consulta' : 'Editar borrador'}
        description={`${patient.patient.name} · Los cambios se guardan como borrador.`}
        action={
          <Button variant="secondary" type="button" onClick={goBack}>
            Cancelar
          </Button>
        }
      />
      <Card className="form-card">
        <form className="domain-form" onSubmit={(event) => void submit(event)} noValidate>
          <p className="clinical-status clinical-status--neutral">BORRADOR</p>
          {serverError ? (
            <Alert tone="error" role="alert">
              {serverError instanceof ApiError && serverError.code === 'CLINICAL_ENCOUNTER_STALE'
                ? 'Esta consulta fue modificada desde otra sesión.'
                : errorMessage(serverError, 'No fue posible guardar el borrador.')}
              {serverError instanceof ApiError &&
              serverError.code === 'CLINICAL_ENCOUNTER_STALE' ? (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    encounter.reload();
                    setServerError(null);
                  }}
                >
                  Recargar versión actual
                </Button>
              ) : null}
            </Alert>
          ) : null}
          <div className="form-section">
            <div>
              <p className="section-kicker">Contexto</p>
              <h2>Datos de la consulta</h2>
            </div>
          </div>
          <div className="form-grid form-grid--two">
            <FormField
              label="Fecha y hora *"
              htmlFor="encounter-occurred-at"
              hint={`Zona horaria: ${organization.data?.timezone ?? 'organización'}`}
            >
              <TextInput
                id="encounter-occurred-at"
                type="datetime-local"
                value={form.occurredAt}
                onChange={(event) => update('occurredAt', event.target.value)}
                aria-invalid={Boolean(errors.occurredAt)}
                required
              />
            </FormField>
            <FormField label="Motivo *" htmlFor="encounter-reason">
              <TextInput
                id="encounter-reason"
                value={form.reason}
                maxLength={500}
                onChange={(event) => update('reason', event.target.value)}
                aria-invalid={Boolean(errors.reason)}
                required
              />
            </FormField>
            <FormField label="Sede *" htmlFor="encounter-location">
              <Select
                id="encounter-location"
                value={form.clinicLocationId}
                onChange={(event) => {
                  const value = event.target.value;
                  update('clinicLocationId', value);
                  if (selectedAppointment && selectedAppointment.clinicLocationId !== value)
                    update('appointmentId', '');
                }}
                required
              >
                <option value="">Selecciona una sede</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Cita asociada"
              htmlFor="encounter-appointment"
              hint="Solo citas de este paciente y no canceladas."
            >
              <Select
                id="encounter-appointment"
                value={form.appointmentId}
                onChange={(event) => {
                  const value = event.target.value;
                  const appointment = appointments.find((item) => item.id === value);
                  if (
                    appointment &&
                    form.clinicLocationId &&
                    appointment.clinicLocationId !== form.clinicLocationId
                  ) {
                    setErrors((current) => ({
                      ...current,
                      appointmentId: 'La cita pertenece a otra sede.',
                    }));
                    return;
                  }
                  update('appointmentId', value);
                  if (appointment && !form.clinicLocationId)
                    update('clinicLocationId', appointment.clinicLocationId);
                }}
              >
                <option value="">Sin cita asociada</option>
                {appointments.map((appointment) => (
                  <AppointmentOption
                    key={appointment.id}
                    appointment={appointment}
                    timezone={organization.data?.timezone ?? 'UTC'}
                  />
                ))}
              </Select>
            </FormField>
            <FormField
              label="Profesional responsable"
              htmlFor="encounter-practitioner"
              hint="Puede quedar sin asignar en el borrador."
            >
              <Select
                id="encounter-practitioner"
                value={form.responsibleMembershipId}
                onChange={(event) => update('responsibleMembershipId', event.target.value)}
              >
                <option value="">Sin asignar</option>
                {(practitioners.data?.data ?? []).map((practitioner) => (
                  <option key={practitioner.membershipId} value={practitioner.membershipId}>
                    {practitioner.displayName ?? 'Profesional sin perfil'}
                    {practitioner.profileConfigured ? '' : ' · Perfil incompleto'}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="form-section">
            <div>
              <p className="section-kicker">Narrativa</p>
              <h2>Notas clínicas</h2>
            </div>
            <p>Los campos son opcionales salvo motivo, sede y fecha.</p>
          </div>
          <div className="form-grid form-grid--two">
            {NARRATIVE_FIELDS.map(([field, label]) => (
              <FormField key={field} label={label} htmlFor={`encounter-${field}`}>
                <textarea
                  id={`encounter-${field}`}
                  className="input input--textarea"
                  value={form[field]}
                  maxLength={20000}
                  onChange={(event) => update(field, event.target.value)}
                  aria-invalid={Boolean(errors[field])}
                />
                {errors[field] ? (
                  <span className="field-error" role="alert">
                    {errors[field]}
                  </span>
                ) : null}
              </FormField>
            ))}
          </div>
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={goBack}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar borrador'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
