import type { AppointmentResponse, AppointmentStatusValue } from '@veterinary-saas/contracts';
import { STATUS_LABELS, STATUS_TONES, type AgendaFilters } from './agendaUtils';

type AgendaWorkflowSummaryProps = {
  appointments: AppointmentResponse[];
  selectedStatus: AgendaFilters['status'];
  onStatusChange: (status: AgendaFilters['status']) => void;
};

const OPERATIONAL_STATUSES: AppointmentStatusValue[] = [
  'SCHEDULED',
  'WAITING_ROOM',
  'IN_PROGRESS',
  'COMPLETED',
  'NO_SHOW',
  'CANCELLED',
];

// Day/List summary turns Appointment.status into a compact operational queue without duplicating data.
export function AgendaWorkflowSummary({
  appointments,
  selectedStatus,
  onStatusChange,
}: AgendaWorkflowSummaryProps) {
  const counts = appointments.reduce<Partial<Record<AppointmentStatusValue, number>>>(
    (result, appointment) => {
      result[appointment.status] = (result[appointment.status] ?? 0) + 1;
      return result;
    },
    {},
  );

  return (
    <section className="agenda-workflow-summary" aria-label="Flujo operativo de agenda">
      <div className="agenda-workflow-summary__heading">
        <div>
          <p className="section-kicker">Operación diaria</p>
          <h2>Sala de espera y estados</h2>
        </div>
        <button
          className="button button--ghost button--compact"
          type="button"
          onClick={() => onStatusChange('ALL')}
          disabled={selectedStatus === 'ALL'}
        >
          Ver todas
        </button>
      </div>
      <div className="agenda-workflow-summary__grid">
        {OPERATIONAL_STATUSES.map((status) => (
          <button
            className={
              selectedStatus === status
                ? 'agenda-workflow-summary__item is-selected'
                : 'agenda-workflow-summary__item'
            }
            type="button"
            key={status}
            onClick={() => onStatusChange(status)}
            aria-pressed={selectedStatus === status}
          >
            <span className={`agenda-status agenda-status--${STATUS_TONES[status]}`}>
              <span className="agenda-status__dot" aria-hidden="true" />
              {STATUS_LABELS[status]}
            </span>
            <strong>{counts[status] ?? 0}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
