import { useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { LoadingState } from '../../components/ui/LoadingState';
import { useClinicalOrganization } from '../clinical/useClinical';
import { useFollowUpDashboardResource } from '../shared/useClinicalDomainResource';
import { civilDateFromDate } from '../agenda/agendaUtils';
import { FollowUpSummaryRow } from './FollowUpSummaryRow';
import './follow-ups.css';

const FOLLOW_UP_MUTATED_EVENT = 'easyvet:follow-up-mutated';

// Dashboard errors stay local to this card so reminders never block the main dashboard.
export function FollowUpDashboardWidget() {
  const canRead = useCan(PERMISSION.FOLLOW_UPS_READ);
  const state = useFollowUpDashboardResource(canRead);
  const reload = state.reload;
  const refresh = useCallback(() => reload(), [reload]);
  useEffect(() => {
    window.addEventListener(FOLLOW_UP_MUTATED_EVENT, refresh);
    return () => window.removeEventListener(FOLLOW_UP_MUTATED_EVENT, refresh);
  }, [refresh]);
  const organization = useClinicalOrganization();
  const timezone = state.data?.timezone ?? organization.data?.timezone ?? 'UTC';
  const today = state.data?.today ?? civilDateFromDate(new Date(), timezone);
  if (!canRead) return null;
  return (
    <Card className="follow-up-widget">
      <div className="card-heading">
        <div>
          <p className="section-kicker">Cuidado pendiente</p>
          <h2>Seguimientos</h2>
        </div>
        <Button as={Link} to="/seguimientos" variant="secondary">
          Abrir cola
        </Button>
      </div>
      {state.loading ? <LoadingState label="Cargando recordatorios" /> : null}
      {state.error ? (
        <Alert tone="warning" role="status">
          Los seguimientos no están disponibles ahora; el dashboard sigue operativo.{' '}
          <Button type="button" variant="secondary" onClick={reload}>
            Reintentar
          </Button>
        </Alert>
      ) : null}
      {state.data ? (
        <>
          <div className="follow-up-widget__counts">
            <span>
              Vencidos <strong>{state.data.counts.overdue}</strong>
            </span>
            <span>
              Hoy <strong>{state.data.counts.today}</strong>
            </span>
            <span>
              Próx. 7 días <strong>{state.data.counts.upcoming7Days}</strong>
            </span>
            <span>
              Recordatorios <strong>{state.data.counts.remindersDue}</strong>
            </span>
          </div>
          <div className="follow-up-list">
            {state.data.nextItems.map((item) => (
              <FollowUpSummaryRow key={item.id} item={item} timezone={timezone} today={today} />
            ))}
          </div>
        </>
      ) : null}
    </Card>
  );
}
