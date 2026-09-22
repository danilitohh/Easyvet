import { Link } from 'react-router-dom';
import type { DiagnosticOrderSummary } from '@veterinary-saas/contracts';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { useClinicalOrganization } from '../clinical/useClinical';
import { formatDateTime } from '../clinical/clinicalUtils';
import { ResourceError } from '../shared/ResourceFeedback';
import { useDiagnosticOrderListResource } from '../shared/useClinicalDomainResource';
import {
  DIAGNOSTIC_CATEGORY_LABEL,
  DIAGNOSTIC_STATUS_LABEL,
  diagnosticStatusTone,
} from './diagnosticUtils';

function EncounterDiagnosticRow({
  patientId,
  item,
  timezone,
}: {
  patientId: string;
  item: DiagnosticOrderSummary;
  timezone: string;
}) {
  return (
    <Link
      className="clinical-domain-row"
      to={`/pacientes/${patientId}/historia/diagnosticos/${item.id}`}
    >
      <span className="clinical-domain-row__main">
        <strong>{item.testName || 'Examen sin nombre'}</strong>
        <small>
          {DIAGNOSTIC_CATEGORY_LABEL[item.category]} ·{' '}
          {item.requestedAt ? formatDateTime(item.requestedAt, timezone) : 'Sin fecha solicitada'} ·{' '}
          {item.responsiblePractitioner?.displayName || 'Sin responsable'}
        </small>
      </span>
      <span className="clinical-domain-row__aside">
        <Badge tone={diagnosticStatusTone(item.status)}>
          {DIAGNOSTIC_STATUS_LABEL[item.status]}
        </Badge>
        {item.parentEncounterStatus === 'VOIDED' ? (
          <small className="clinical-domain-warning">Consulta anulada</small>
        ) : null}
      </span>
    </Link>
  );
}

// Embeds encounter-scoped diagnostic history and only exposes creation when both records allow it.
export function DiagnosticEncounterSection({
  patientId,
  encounterId,
  encounterStatus,
  patientStatus,
}: {
  patientId: string;
  encounterId: string;
  encounterStatus: 'DRAFT' | 'FINALIZED' | 'VOIDED';
  patientStatus: 'ACTIVE' | 'ARCHIVED';
}) {
  const canRead = useCan(PERMISSION.DIAGNOSTICS_READ);
  const canCreate = useCan(PERMISSION.DIAGNOSTICS_CREATE);
  const organization = useClinicalOrganization();
  const orders = useDiagnosticOrderListResource(patientId, 1, canRead, encounterId);
  const mayCreate = canCreate && encounterStatus !== 'VOIDED' && patientStatus === 'ACTIVE';

  if (!canRead && !canCreate) return null;

  return (
    <Card className="clinical-domain-list diagnostic-encounter-section">
      <div className="detail-card__heading">
        <div>
          <p className="section-kicker">Apoyos diagnósticos</p>
          <h2>Diagnósticos y exámenes</h2>
        </div>
        {mayCreate ? (
          <Button
            as={Link}
            to={`/pacientes/${patientId}/historia/encuentros/${encounterId}/diagnosticos/nuevo`}
          >
            Solicitar examen
          </Button>
        ) : null}
      </div>
      {encounterStatus === 'VOIDED' ? (
        <p className="clinical-warning" role="status">
          La consulta está anulada. Las órdenes existentes se conservan como historial y no se
          pueden modificar.
        </p>
      ) : null}
      {patientStatus === 'ARCHIVED' ? (
        <p className="clinical-warning" role="status">
          El paciente está archivado. El historial se puede consultar, pero no se pueden crear ni
          actualizar solicitudes o resultados.
        </p>
      ) : null}
      {canRead ? (
        orders.loading ? (
          <LoadingState label="Cargando solicitudes diagnósticas del encuentro" />
        ) : orders.error ? (
          <ResourceError error={orders.error} onRetry={orders.reload} />
        ) : orders.data?.data.length ? (
          <div className="clinical-domain-rows">
            {orders.data.data.map((item) => (
              <EncounterDiagnosticRow
                key={item.id}
                item={item}
                patientId={patientId}
                timezone={organization.data?.timezone ?? 'UTC'}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Este encuentro no tiene solicitudes diagnósticas"
            description="Los estudios y sus resultados se conservan junto al encuentro clínico."
          />
        )
      ) : (
        <p className="clinical-muted">No tienes permiso para consultar las órdenes existentes.</p>
      )}
    </Card>
  );
}
