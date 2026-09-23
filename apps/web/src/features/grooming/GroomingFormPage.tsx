import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type {
  CreateGroomingVisitRequest,
  UpdateGroomingVisitRequest,
} from '@veterinary-saas/contracts';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { ApiError } from '../../services/apiClient';
import { useActiveOrganizationId } from '../shared/hooks';
import { useClinicalOrganization } from '../clinical/useClinical';
import { useClinicalMutationGuard } from '../shared/useClinicalDomainResource';
import {
  useGroomingAppointments,
  useGroomingOptions,
  useGroomingVisitResource,
} from './useGroomingResources';
import { groomingApi } from './groomingApi';
import { groomingErrorMessage, notifyGroomingMutation } from './groomingViewUtils';
import './grooming.css';

type GroomingFormState = {
  patientId: string;
  clinicLocationId: string;
  appointmentId: string;
  assignedGroomerMembershipId: string;
  serviceSummary: string;
  coatCondition: string;
  skinObservations: string;
  temperamentNotes: string;
  preServiceNotes: string;
  postServiceNotes: string;
  incidentNotes: string;
};

const blankForm = (patientId = ''): GroomingFormState => ({
  patientId,
  clinicLocationId: '',
  appointmentId: '',
  assignedGroomerMembershipId: '',
  serviceSummary: '',
  coatCondition: '',
  skinObservations: '',
  temperamentNotes: '',
  preServiceNotes: '',
  postServiceNotes: '',
  incidentNotes: '',
});

// Create and edit share field layout while the server independently restricts lifecycle-owned fields.
export function GroomingFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { groomingVisitId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const organization = useClinicalOrganization();
  const organizationId = useActiveOrganizationId();
  const mutationGuard = useClinicalMutationGuard();
  const canCreate = useCan(PERMISSION.GROOMING_CREATE);
  const canUpdate = useCan(PERMISSION.GROOMING_UPDATE_DRAFT);
  const canPerform = useCan(PERMISSION.GROOMING_PERFORM);
  const canReadAppointments = useCan(PERMISSION.APPOINTMENTS_READ);
  const detail = useGroomingVisitResource(
    mode === 'edit' ? groomingVisitId : undefined,
    mode === 'edit',
  );
  const options = useGroomingOptions(
    mode === 'create' || (mode === 'edit' && detail.data?.status === 'DRAFT'),
  );
  const patientIdForAppointments = mode === 'edit' ? detail.data?.patientId : undefined;
  const [form, setForm] = useState<GroomingFormState>(() =>
    blankForm(searchParams.get('patientId') ?? ''),
  );
  const [loadedVisitId, setLoadedVisitId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);
  const patientIdForOptions = mode === 'create' ? form.patientId : patientIdForAppointments;
  const appointments = useGroomingAppointments(
    patientIdForOptions,
    canReadAppointments &&
      Boolean(patientIdForOptions) &&
      (mode === 'create' || detail.data?.status === 'DRAFT'),
    mode === 'edit' ? detail.data?.appointmentId : undefined,
  );
  const isActive = detail.data?.status === 'IN_PROGRESS';
  const isDraft = mode === 'create' || detail.data?.status === 'DRAFT';
  const isEditable =
    mode === 'create' ? canCreate : canUpdate && (isDraft || (isActive && canPerform));
  const filteredAppointments = useMemo(
    () =>
      (appointments.data?.data ?? []).filter(
        (appointment) =>
          appointment.clinicLocationId ===
            (mode === 'edit' && isActive ? detail.data?.clinicLocationId : form.clinicLocationId) &&
          ((appointment.status !== 'CANCELLED' && appointment.status !== 'NO_SHOW') ||
            appointment.id === detail.data?.appointmentId),
      ),
    [
      appointments.data,
      detail.data?.appointmentId,
      detail.data?.clinicLocationId,
      form.clinicLocationId,
      isActive,
      mode,
    ],
  );

  // Tenant, route or edit-target changes discard every unsaved reference and field value.
  useEffect(() => {
    setForm(blankForm(searchParams.get('patientId') ?? ''));
    setLoadedVisitId('');
    setError(null);
    setAppointmentsError(null);
  }, [organizationId, mode, groomingVisitId, searchParams]);

  // Edit forms hydrate once per tenant-scoped visit and never overwrite the user's later typing.
  useEffect(() => {
    if (mode !== 'edit' || !detail.data || loadedVisitId === detail.data.id) return;
    setForm({
      patientId: detail.data.patientId,
      clinicLocationId: detail.data.clinicLocationId,
      appointmentId: detail.data.appointmentId ?? '',
      assignedGroomerMembershipId: detail.data.assignedGroomerMembershipId ?? '',
      serviceSummary: detail.data.serviceSummary ?? '',
      coatCondition: detail.data.coatCondition ?? '',
      skinObservations: detail.data.skinObservations ?? '',
      temperamentNotes: detail.data.temperamentNotes ?? '',
      preServiceNotes: detail.data.preServiceNotes ?? '',
      postServiceNotes: detail.data.postServiceNotes ?? '',
      incidentNotes: detail.data.incidentNotes ?? '',
    });
    setLoadedVisitId(detail.data.id);
  }, [detail.data, loadedVisitId, mode]);

  useEffect(() => {
    if (appointments.error instanceof ApiError)
      setAppointmentsError('No se pudieron cargar las citas del paciente.');
    else if (appointments.error)
      setAppointmentsError('No se pudieron cargar las citas del paciente.');
    else setAppointmentsError(null);
  }, [appointments.error]);

  // The service is saved as an operational draft; start and completion have separate confirmations.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!isEditable) return;
    if (mode === 'create' && !form.patientId) {
      setError('Selecciona un paciente activo.');
      return;
    }
    if (!form.clinicLocationId) {
      setError('Selecciona una sede activa.');
      return;
    }
    const signal = mutationGuard.signal();
    setSaving(true);
    try {
      if (mode === 'create') {
        const request: CreateGroomingVisitRequest = {
          clinicLocationId: form.clinicLocationId,
          appointmentId: form.appointmentId || null,
          assignedGroomerMembershipId: form.assignedGroomerMembershipId || null,
          serviceSummary: form.serviceSummary,
          coatCondition: form.coatCondition,
          skinObservations: form.skinObservations,
          temperamentNotes: form.temperamentNotes,
          preServiceNotes: form.preServiceNotes,
        };
        const created = await groomingApi.create(form.patientId, request, signal);
        if (!mutationGuard.isCurrent()) return;
        notifyGroomingMutation();
        navigate(`/peluqueria/${created.id}`);
      } else if (detail.data) {
        const request: UpdateGroomingVisitRequest = {
          expectedVersion: detail.data.version,
          ...(isDraft
            ? {
                clinicLocationId: form.clinicLocationId,
                appointmentId: form.appointmentId || null,
                assignedGroomerMembershipId: form.assignedGroomerMembershipId || null,
              }
            : {}),
          serviceSummary: form.serviceSummary,
          coatCondition: form.coatCondition,
          skinObservations: form.skinObservations,
          temperamentNotes: form.temperamentNotes,
          preServiceNotes: form.preServiceNotes,
          postServiceNotes: form.postServiceNotes,
          incidentNotes: form.incidentNotes,
        };
        const updated = await groomingApi.update(groomingVisitId, request, signal);
        if (!mutationGuard.isCurrent()) return;
        notifyGroomingMutation();
        navigate(`/peluqueria/${updated.id}`);
      }
    } catch (cause) {
      if (!mutationGuard.isCurrent()) return;
      setError(groomingErrorMessage(cause, 'No fue posible guardar la atención.'));
    } finally {
      if (mutationGuard.isCurrent()) setSaving(false);
    }
  }

  const pageTitle =
    mode === 'create'
      ? 'Nueva atención'
      : isActive
        ? 'Actualizar atención en curso'
        : 'Editar borrador';
  if (mode === 'edit' && detail.loading)
    return <LoadingState label="Cargando atención de peluquería" />;
  if (mode === 'edit' && detail.error)
    return (
      <Card>
        <Alert tone="error" role="alert">
          No fue posible cargar la atención.{' '}
          <Button type="button" variant="secondary" onClick={detail.reload}>
            Reintentar
          </Button>
        </Alert>
      </Card>
    );
  if (mode === 'edit' && detail.data && !isDraft && !isActive)
    return (
      <Alert tone="warning" role="status">
        Las atenciones completadas o anuladas son de solo lectura.
      </Alert>
    );

  return (
    <div className="page-stack grooming-page">
      <PageHeader
        eyebrow="Peluquería · Servicio operativo"
        title={pageTitle}
        description="Guarda los datos del servicio. El historial de peluquería no crea ni modifica consultas clínicas."
        action={
          <Button
            as={Link}
            to={mode === 'edit' ? `/peluqueria/${groomingVisitId}` : '/peluqueria'}
            variant="secondary"
          >
            Cancelar
          </Button>
        }
      />
      {detail.data?.patient.status === 'ARCHIVED' ? (
        <Alert tone="warning" role="status">
          El paciente está archivado; no se puede modificar esta atención.
        </Alert>
      ) : null}
      {mode === 'create' && options.loading ? (
        <Card>
          <LoadingState label="Cargando pacientes, sedes y peluqueros" />
        </Card>
      ) : null}
      {options.error ? (
        <ResourceErrorMessage text="No fue posible cargar las opciones de atención." />
      ) : null}
      {error ? (
        <Alert tone="error" role="alert">
          {error}
        </Alert>
      ) : null}
      {appointmentsError ? (
        <Alert tone="warning" role="status">
          {appointmentsError} Puedes guardar la atención sin vincular una cita.
        </Alert>
      ) : null}
      <Card className="grooming-form-card">
        <form className="grooming-form" onSubmit={submit}>
          {mode === 'create' ? (
            <FormField
              label="Paciente"
              htmlFor="grooming-patient"
              hint="Solo se muestran pacientes activos de la organización seleccionada."
            >
              <Select
                id="grooming-patient"
                required
                value={form.patientId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    patientId: event.target.value,
                    appointmentId: '',
                  }))
                }
              >
                <option value="">Seleccionar paciente</option>
                {options.data?.patients.data.map((patient) => (
                  <option value={patient.id} key={patient.id}>
                    {patient.name} · {patient.owner.firstName} {patient.owner.lastName ?? ''}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : (
            <div className="grooming-form__patient">
              <span>Paciente</span>
              <strong>{detail.data?.patientNameSnapshot ?? detail.data?.patient.name}</strong>
              <small>Propietario histórico: {detail.data?.ownerAtTime.displayName}</small>
            </div>
          )}
          {isActive && detail.data ? (
            <div className="grooming-form__immutable">
              <span>Sede fijada</span>
              <strong>{detail.data.clinicLocation.name}</strong>
            </div>
          ) : (
            <FormField label="Sede" htmlFor="grooming-location">
              <Select
                id="grooming-location"
                required
                value={form.clinicLocationId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    clinicLocationId: event.target.value,
                    appointmentId: '',
                  }))
                }
              >
                <option value="">Seleccionar sede</option>
                {options.data?.locations
                  .filter((location) => location.status === 'ACTIVE')
                  .map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
              </Select>
            </FormField>
          )}
          {canReadAppointments ? (
            isActive && detail.data ? (
              <div className="grooming-form__immutable">
                <span>Cita relacionada</span>
                <strong>
                  {detail.data.appointment
                    ? `${detail.data.appointment.reason} · ${detail.data.appointment.status}`
                    : 'Sin cita vinculada'}
                </strong>
              </div>
            ) : (
              <FormField
                label="Cita vinculada (opcional)"
                htmlFor="grooming-appointment"
                hint="La cita debe pertenecer al mismo paciente y sede; la agenda conserva su propio estado."
              >
                <Select
                  id="grooming-appointment"
                  disabled={!isDraft || !patientIdForOptions || appointments.loading}
                  value={form.appointmentId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, appointmentId: event.target.value }))
                  }
                >
                  <option value="">Sin cita</option>
                  {filteredAppointments.map((appointment) => (
                    <option key={appointment.id} value={appointment.id}>
                      {new Intl.DateTimeFormat('es-CO', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: organization.data?.timezone ?? 'America/Bogota',
                      }).format(new Date(appointment.startsAt))}{' '}
                      · {appointment.reason} · {appointment.status}
                    </option>
                  ))}
                </Select>
              </FormField>
            )
          ) : null}
          {isActive && detail.data ? (
            <div className="grooming-form__immutable">
              <span>Peluquero responsable</span>
              <strong>
                {detail.data.groomerDisplayNameSnapshot ??
                  detail.data.assignedGroomer?.displayName ??
                  'Sin asignar'}
              </strong>
            </div>
          ) : (
            <FormField
              label="Peluquero responsable"
              htmlFor="grooming-groomer"
              hint="Se requiere un miembro activo con permiso para realizar peluquería antes de iniciar."
            >
              <Select
                id="grooming-groomer"
                value={form.assignedGroomerMembershipId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    assignedGroomerMembershipId: event.target.value,
                  }))
                }
              >
                <option value="">Sin asignar</option>
                {options.data?.groomers.map((member) => (
                  <option value={member.id} key={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          <FormField
            label="Servicio solicitado"
            htmlFor="grooming-service"
            hint="Debe estar definido antes de iniciar atención."
          >
            <textarea
              id="grooming-service"
              className="input grooming-textarea"
              maxLength={1000}
              value={form.serviceSummary}
              onChange={(event) =>
                setForm((current) => ({ ...current, serviceSummary: event.target.value }))
              }
            />
          </FormField>
          <div className="grooming-form__section">
            <p className="section-kicker">Recepción y condición inicial</p>
            <div className="grooming-form__grid">
              <FormField label="Estado del pelaje" htmlFor="grooming-coat">
                <textarea
                  id="grooming-coat"
                  className="input grooming-textarea"
                  maxLength={5000}
                  value={form.coatCondition}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, coatCondition: event.target.value }))
                  }
                />
              </FormField>
              <FormField label="Observaciones de piel" htmlFor="grooming-skin">
                <textarea
                  id="grooming-skin"
                  className="input grooming-textarea"
                  maxLength={5000}
                  value={form.skinObservations}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, skinObservations: event.target.value }))
                  }
                />
              </FormField>
              <FormField label="Temperamento" htmlFor="grooming-temperament">
                <textarea
                  id="grooming-temperament"
                  className="input grooming-textarea"
                  maxLength={5000}
                  value={form.temperamentNotes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, temperamentNotes: event.target.value }))
                  }
                />
              </FormField>
              <FormField label="Notas previas al servicio" htmlFor="grooming-pre-notes">
                <textarea
                  id="grooming-pre-notes"
                  className="input grooming-textarea"
                  maxLength={5000}
                  value={form.preServiceNotes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, preServiceNotes: event.target.value }))
                  }
                />
              </FormField>
            </div>
          </div>
          {isActive ? (
            <div className="grooming-form__section">
              <p className="section-kicker">En atención</p>
              <div className="grooming-form__grid">
                <FormField label="Notas posteriores" htmlFor="grooming-post-notes">
                  <textarea
                    id="grooming-post-notes"
                    className="input grooming-textarea"
                    maxLength={5000}
                    value={form.postServiceNotes}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, postServiceNotes: event.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Incidentes operativos" htmlFor="grooming-incidents">
                  <textarea
                    id="grooming-incidents"
                    className="input grooming-textarea"
                    maxLength={5000}
                    value={form.incidentNotes}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, incidentNotes: event.target.value }))
                    }
                  />
                </FormField>
              </div>
            </div>
          ) : null}
          <div className="grooming-form__actions">
            <Button
              type="submit"
              disabled={!isEditable || saving || detail.data?.patient.status === 'ARCHIVED'}
            >
              {saving ? 'Guardando…' : mode === 'create' ? 'Guardar borrador' : 'Guardar cambios'}
            </Button>
            <Button
              as={Link}
              to={mode === 'edit' ? `/peluqueria/${groomingVisitId}` : '/peluqueria'}
              variant="secondary"
            >
              Volver
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function ResourceErrorMessage({ text }: { text: string }) {
  return (
    <Alert tone="error" role="alert">
      {text}
    </Alert>
  );
}
