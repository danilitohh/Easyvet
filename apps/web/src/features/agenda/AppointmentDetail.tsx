import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { ResourceError } from '../shared/ResourceFeedback';
import {
  appointmentDurationMinutes,
  appointmentOwnerName,
  appointmentProfessionalName,
  STATUS_LABELS,
  STATUS_TONES,
} from './agendaUtils';
import { useAgendaAppointment } from './useAgenda';

type AppointmentDetailProps = {
  appointmentId: string | undefined;
  timezone: string;
  onClose: () => void;
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

// Detail is intentionally read-only; operational mutations arrive in Fase 5C.2.
export function AppointmentDetail({ appointmentId, timezone, onClose }: AppointmentDetailProps) {
  const detail = useAgendaAppointment(appointmentId);
  const appointment = detail.data;
  return (
    <Modal
      open={Boolean(appointmentId)}
      title={appointment?.patient.name ?? 'Detalle de cita'}
      description={appointment?.reason ?? 'Consulta de información de la cita'}
      eyebrow="Agenda · Solo lectura"
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
        </div>
      ) : null}
    </Modal>
  );
}
