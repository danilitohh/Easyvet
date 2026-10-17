import { Link } from 'react-router-dom';
import type { ClinicalFollowUpSummary } from '@veterinary-saas/contracts';
import { Badge } from '../../components/ui/Badge';
import { EasyvetIcon } from '../../components/icons/EasyvetIcon';
import { dueState, formatFollowUpLocal } from './followUpViewUtils';

// A compact row centralizes the safe summary used by queues, history, and the dashboard.
export function FollowUpSummaryRow({
  item,
  timezone,
  today,
}: {
  item: ClinicalFollowUpSummary;
  timezone: string;
  today: string;
}) {
  const due = dueState(item, today);
  return (
    <Link className="follow-up-row" to={`/seguimientos/${item.id}`}>
      <span className="follow-up-row__main">
        <strong>
          {item.patient.name} · {item.title}
        </strong>
        <small>
          {item.patient.species} · Responsable: {item.patient.owner.displayName}
        </small>
        {item.sourceEncounter ? (
          <small>
            Consulta: {item.sourceEncounter.reason} ·{' '}
            {item.sourceEncounter.status === 'VOIDED' ? 'anulada' : 'vinculada'}
          </small>
        ) : null}
      </span>
      <span className="follow-up-row__meta">
        {due ? (
          <Badge tone={due.tone}>{due.label}</Badge>
        ) : (
          <Badge>{item.status === 'COMPLETED' ? 'Completado' : 'Anulado'}</Badge>
        )}
        <small>Vence {item.dueOn}</small>
        {item.reminderAt ? (
          <small>
            {item.reminderDue ? 'Recordatorio pendiente' : 'Recordatorio'} ·{' '}
            {formatFollowUpLocal(item.reminderAt, timezone)}
          </small>
        ) : null}
        <small>{item.assignedMember?.displayName ?? 'Sin asignar'}</small>
      </span>
      <span aria-hidden="true" className="follow-up-row__arrow">
        <EasyvetIcon name="arrow-up-right" size={16} />
      </span>
    </Link>
  );
}
