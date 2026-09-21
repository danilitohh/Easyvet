import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
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
import { useAgendaAppointment } from './useAgenda';

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
  const [updatedAppointment, setUpdatedAppointment] = useState<typeof detail.data>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<unknown>(null);
  const [cancelSaving, setCancelSaving] = useState(false);
  const appointment = updatedAppointment ?? detail.data;

  useEffect(() => {
    setUpdatedAppointment(null);
    setCancelOpen(false);
    setCancelReason('');
    setCancelError(null);
  }, [appointmentId]);

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
                <span>Confirmación Owner</span>
                <Badge tone={appointment.ownerConfirmedAt ? 'success' : 'neutral'}>
                  {appointment.ownerConfirmedAt ? 'Sí' : 'No'}
                </Badge>
              </div>
              <div>
                <span>Confirmación clínica</span>
                <Badge tone={appointment.clinicConfirmedAt ? 'success' : 'neutral'}>
                  {appointment.clinicConfirmedAt ? 'Sí' : 'No'}
                </Badge>
              </div>
            </div>
            {appointment.status === 'CANCELLED' ? (
              <div className="appointment-detail__cancellation">
                <span>Cancelación</span>
                <p>{appointment.cancellationReason ?? 'Sin motivo registrado'}</p>
              </div>
            ) : null}
            {canEdit || canReschedule || canCancelAppointment ? (
              <div className="appointment-detail__actions">
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
