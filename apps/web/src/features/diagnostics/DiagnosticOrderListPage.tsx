import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { DiagnosticOrderSummary } from '@veterinary-saas/contracts';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { useClinicalOrganization } from '../clinical/useClinical';
import { formatDateTime } from '../clinical/clinicalUtils';
import { PaginationControls, ResourceError } from '../shared/ResourceFeedback';
import { useDiagnosticOrderListResource } from '../shared/useClinicalDomainResource';
import {
  DIAGNOSTIC_CATEGORY_LABEL,
  DIAGNOSTIC_STATUS_LABEL,
  diagnosticStatusTone,
} from './diagnosticUtils';

function DiagnosticOrderRow({
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
          {item.responsiblePractitioner?.displayName || 'Sin responsable'} · Consulta{' '}
          {item.encounter.status === 'VOIDED'
            ? 'anulada'
            : item.encounter.status === 'FINALIZED'
              ? 'finalizada'
              : 'en borrador'}
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

// Shows the patient's request and result history in compact responsive rows.
export function DiagnosticOrderListPage() {
  const { patientId = '' } = useParams<{ patientId: string }>();
  const [page, setPage] = useState(1);
  const organization = useClinicalOrganization();
  const resource = useDiagnosticOrderListResource(patientId, page, true);
  const timezone = organization.data?.timezone ?? 'UTC';

  return (
    <section className="page-stack clinical-page clinical-domain-page">
      <PageHeader
        eyebrow="Historia clínica · Diagnósticos"
        title="Diagnósticos y exámenes"
        description="Solicitudes clínicas, resultados y su contexto histórico por encuentro."
        action={
          <Link className="button button--secondary" to={`/pacientes/${patientId}/historia`}>
            Volver a historia
          </Link>
        }
      />
      {organization.error ? (
        <ResourceError error={organization.error} onRetry={organization.reload} />
      ) : null}
      {resource.loading ? (
        <Card>
          <LoadingState label="Cargando diagnósticos y exámenes" />
        </Card>
      ) : resource.error ? (
        <Card>
          <ResourceError error={resource.error} onRetry={resource.reload} />
        </Card>
      ) : (
        <Card className="clinical-domain-list">
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Estudios</p>
              <h2>Historial diagnóstico</h2>
            </div>
            <Badge>{`${resource.data?.pagination.total ?? 0} registros`}</Badge>
          </div>
          {resource.data?.data.length ? (
            <div className="clinical-domain-rows">
              {resource.data.data.map((item) => (
                <DiagnosticOrderRow
                  key={item.id}
                  item={item}
                  patientId={patientId}
                  timezone={timezone}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No hay solicitudes diagnósticas"
              description="Las órdenes se crean desde un encuentro clínico y conservan allí su contexto."
            />
          )}
          <PaginationControls
            page={resource.data?.pagination.page ?? 1}
            totalPages={resource.data?.pagination.totalPages ?? 0}
            onChange={setPage}
          />
        </Card>
      )}
    </section>
  );
}
