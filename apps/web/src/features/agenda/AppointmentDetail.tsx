import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { FormField } from '../../components/ui/FormField';
import { TextInput } from '../../components/ui/TextInput';
import { useCan } from '../../auth/useCan';
import { PERMISSION } from '../../auth/permissions';
import { ResourceError } from '../shared/ResourceFeedback';
import {
  appointmentDurationMinutes,
  appointmentOwnerName,
  appointmentProfessionalName,
  STATUS_LABELS,
  STATUS_TONES,
} from './agendaUtils';
import { agendaApi } from './agendaApi';
import type { AppointmentResponse } from '@veterinary-saas/contracts';
import { useAgendaAppointment } from './useAgenda';
import { ApiError } from '../../services/apiClient';
import { errorMessage } from '../shared/resourceUtils';

type AppointmentDetailProps = {
  appointmentId: string | undefined;
  timezone: string;
  onClose: () => void;
  onChanged?: () => void;
};

function formatDateTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: timezone,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function formatConfirmation(value: string | null, timezone: string): string {
  return value ? formatDateTime(value, timezone) : 'Pendiente';
}

// Detail keeps lifecycle workflow actions explicit; status transitions remain out of this phase.
export function AppointmentDetail({
  appointmentId,
  timezone,
  onClose,
  onChanged,
}: AppointmentDetailProps) {
  const detail = useAgendaAppointment(appointmentId);
  const location = useLocation();
  const canUpdate = useCan(PERMISSION.APPOINTMENTS_UPDATE);
  const canCancel = useCan(PERMISSION.APPOINTMENTS_CANCEL);
  const canCheckInPermission = useCan(PERMISSION.APPOINTMENTS_CHECK_IN);
  const canStartPermission = useCan(PERMISSION.APPOINTMENTS_START);
  const canCompletePermission = useCan(PERMISSION.APPOINTMENTS_COMPLETE);
  const canNoShowPermission = useCan(PERMISSION.APPOINTMENTS_MARK_NO_SHOW);
  const [updatedAppointment, setUpdatedAppointment] = useState<typeof detail.data>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<unknown>(null);
  const [cancelSaving, setCancelSaving] = useState(false);
  const [workflowError, setWorkflowError] = useState<unknown>(null);
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [noShowOpen, setNoShowOpen] = useState(false);
  const appointment = updatedAppointment ?? detail.data;

  useEffect(() => {
    setUpdatedAppointment(null);
    setCancelOpen(false);
    setCancelReason('');
    setCancelError(null);
    setWorkflowError(null);
    setNoShowOpen(false);
  }, [appointmentId]);

  async function runWorkflowAction(
    action: (appointmentId: string) => Promise<AppointmentResponse>,
  ) {
    if (!appointment) return;
    setWorkflowSaving(true);
    setWorkflowError(null);
    try {
      const saved = await action(appointment.id);
      setUpdatedAppointment(saved);
      setNoShowOpen(false);
      onChanged?.();
    } catch (error: unknown) {
      setWorkflowError(error);
      setUpdatedAppointment(null);
      detail.reload();
    } finally {
      setWorkflowSaving(false);
    }
  }

  async function cancelAppointment() {
    if (!appointment) return;
    setCancelSaving(true);
    setCancelError(null);
    try {
      const saved = await agendaApi.cancelAppointment(appointment.id, {
        cancellationReason: cancelReason.trim() || null,
      });
      setUpdatedAppointment(saved);
      setCancelOpen(false);
      onChanged?.();
    } catch (error: unknown) {
      setCancelError(error);
    } finally {
      setCancelSaving(false);
    }
  }

  const canEdit = Boolean(
    appointment && canUpdate && ['SCHEDULED', 'WAITING_ROOM'].includes(appointment.status),
  );
  const canReschedule = Boolean(appointment && canUpdate && appointment.status === 'SCHEDULED');
  const canCancelAppointment = Boolean(
    appointment && canCancel && ['SCHEDULED', 'WAITING_ROOM'].includes(appointment.status),
  );
  const canCheckIn = Boolean(
    appointment && canCheckInPermission && appointment.status === 'SCHEDULED',
  );
  const canStart = Boolean(
    appointment && canStartPermission && appointment.status === 'WAITING_ROOM',
  );
  const canComplete = Boolean(
    appointment && canCompletePermission && appointment.status === 'IN_PROGRESS',
  );
  const canNoShow = Boolean(
    appointment &&
    canNoShowPermission &&
    ['SCHEDULED', 'WAITING_ROOM'].includes(appointment.status),
  );
  const canConfirmClinic = Boolean(
    appointment &&
    canUpdate &&
    !appointment.clinicConfirmedAt &&
    !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appointment.status),
  );
  const workflowConflict =
    workflowError instanceof ApiError && workflowError.status === 409
      ? 'La cita cambió mientras la estabas viendo. Actualizamos la información.'
      : workflowError
        ? errorMessage(workflowError, 'No fue posible actualizar el estado de la cita.')
        : null;
  return (
    <>
      <Modal
        open={Boolean(appointmentId)}
        title={appointment?.patient.name ?? 'Detalle de cita'}
        description={appointment?.reason ?? 'Consulta de información de la cita'}
        eyebrow="Agenda · Cita"
        onClose={onClose}
      >
        {detail.loading ? (
          <div className="loading-state" role="status" aria-label="Cargando detalle">
            <span className="loading-state__bar" />
            <span className="loading-state__bar loading-state__bar--short" />
          </div>
        ) : null}
        {detail.error ? <ResourceError error={detail.error} onRetry={detail.reload} /> : null}
        {workflowConflict ? (
          <Alert tone="error" role="alert">
            {workflowConflict}
          </Alert>
        ) : null}
        {appointment ? (
          <div className="appointment-detail">
            <div className="appointment-detail__status-row">
              <span className={`agenda-status agenda-status--${STATUS_TONES[appointment.status]}`}>
                <span className="agenda-status__dot" aria-hidden="true" />
                {STATUS_LABELS[appointment.status]}
              </span>
              <span className="appointment-detail__duration">
                {appointmentDurationMinutes(appointment)} min
              </span>
            </div>
            <dl className="appointment-detail__grid">
              <div>
                <dt>Fecha</dt>
                <dd>{formatDateTime(appointment.startsAt, timezone)}</dd>
              </div>
              <div>
                <dt>Horario</dt>
                <dd>
                  {formatTime(appointment.startsAt, timezone)} a{' '}
                  {formatTime(appointment.endsAt, timezone)}
                </dd>
              </div>
              <div>
                <dt>Patient</dt>
                <dd>{appointment.patient.name}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{appointmentOwnerName(appointment)}</dd>
              </div>
              <div>
                <dt>Sede</dt>
                <dd>{appointment.clinicLocation.name}</dd>
              </div>
              <div>
                <dt>Profesional</dt>
                <dd>{appointmentProfessionalName(appointment)}</dd>
              </div>
            </dl>
            <div className="appointment-detail__notes">
              <div>
                <span>Motivo</span>
                <p>{appointment.reason}</p>
              </div>
              {appointment.notes ? (
                <div>
                  <span>Notas</span>
                  <p>{appointment.notes}</p>
                </div>
              ) : null}
              {appointment.observations ? (
                <div>
                  <span>Observaciones</span>
                  <p>{appointment.observations}</p>
                </div>
              ) : null}
            </div>
            <div className="appointment-detail__confirmation" aria-label="Confirmaciones">
              <div>
                <span>Confirmación propietario</span>
                <Badge tone={appointment.ownerConfirmedAt ? 'success' : 'neutral'}>
                  {appointment.ownerConfirmedAt ? 'Confirmada' : 'Pendiente'}
                </Badge>
                {appointment.ownerConfirmedAt ? (
                  <small>{formatConfirmation(appointment.ownerConfirmedAt, timezone)}</small>
                ) : null}
              </div>
              <div>
                <span>Confirmación clínica</span>
                <Badge tone={appointment.clinicConfirmedAt ? 'success' : 'neutral'}>
                  {appointment.clinicConfirmedAt ? 'Confirmada' : 'Pendiente'}
                </Badge>
                {appointment.clinicConfirmedAt ? (
                  <small>{formatConfirmation(appointment.clinicConfirmedAt, timezone)}</small>
                ) : null}
              </div>
            </div>
            {appointment.status === 'CANCELLED' ? (
              <div className="appointment-detail__cancellation">
                <span>Cancelación</span>
                <p>{appointment.cancellationReason ?? 'Sin motivo registrado'}</p>
              </div>
            ) : null}
            {canEdit ||
            canReschedule ||
            canCancelAppointment ||
            canCheckIn ||
            canStart ||
            canComplete ||
            canNoShow ||
            canConfirmClinic ? (
              <div className="appointment-detail__actions">
                {canCheckIn ? (
                  <Button
                    type="button"
                    disabled={workflowSaving}
                    onClick={() => void runWorkflowAction(agendaApi.checkInAppointment)}
                  >
                    {workflowSaving ? 'Registrando…' : 'Registrar llegada'}
                  </Button>
                ) : null}
                {canStart ? (
                  <Button
                    type="button"
                    disabled={workflowSaving}
                    onClick={() => void runWorkflowAction(agendaApi.startAppointment)}
                  >
                    {workflowSaving ? 'Iniciando…' : 'Iniciar atención'}
                  </Button>
                ) : null}
                {canComplete ? (
                  <Button
                    type="button"
                    disabled={workflowSaving}
                    onClick={() => void runWorkflowAction(agendaApi.completeAppointment)}
                  >
                    {workflowSaving ? 'Completando…' : 'Completar cita'}
                  </Button>
                ) : null}
                {canConfirmClinic ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={workflowSaving}
                    onClick={() => void runWorkflowAction(agendaApi.confirmByClinic)}
                  >
                    Confirmar por clínica
                  </Button>
                ) : null}
                {canNoShow ? (
                  <Button
                    type="button"
                    variant="danger"
                    disabled={workflowSaving}
                    onClick={() => setNoShowOpen(true)}
                  >
                    No asistió
                  </Button>
                ) : null}
                {canEdit ? (
                  <Button
                    as={Link}
                    to={`/agenda/citas/${appointment.id}/editar${location.search}`}
                    variant="secondary"
                  >
                    Editar información
                  </Button>
                ) : null}
                {canReschedule ? (
                  <Button
                    as={Link}
                    to={`/agenda/citas/${appointment.id}/reprogramar${location.search}`}
                    variant="secondary"
                  >
                    Reprogramar
                  </Button>
                ) : null}
                {canCancelAppointment ? (
                  <Button type="button" variant="danger" onClick={() => setCancelOpen(true)}>
                    Cancelar cita
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
      <Modal
        open={noShowOpen}
        title="Marcar como no asistió"
        description="La cita permanecerá registrada con estado No asistió."
        eyebrow="Agenda · Confirmación"
        onClose={() => setNoShowOpen(false)}
      >
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={() => setNoShowOpen(false)}>
            Volver
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={workflowSaving}
            onClick={() => void runWorkflowAction(agendaApi.markNoShow)}
          >
            {workflowSaving ? 'Guardando…' : 'Confirmar no-show'}
          </Button>
        </div>
      </Modal>
      <Modal
        open={cancelOpen}
        title="Cancelar cita"
        description="La cita permanecerá registrada con estado Cancelada."
        eyebrow="Agenda · Confirmación"
        onClose={() => setCancelOpen(false)}
      >
        {cancelError ? <ResourceError error={cancelError} /> : null}
        <FormField label="Motivo de cancelación" htmlFor="appointment-cancellation-reason">
          <TextInput
            id="appointment-cancellation-reason"
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="Ej. Owner solicita cambio"
          />
        </FormField>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={() => setCancelOpen(false)}>
            Volver
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={cancelSaving}
            onClick={() => void cancelAppointment()}
          >
            {cancelSaving ? 'Cancelando…' : 'Confirmar cancelación'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
