import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { AnesthesiaRecordSummary, ClinicalProcedureSummary } from '@veterinary-saas/contracts';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { ResourceError, PaginationControls } from '../shared/ResourceFeedback';
import { useClinicalOrganization } from '../clinical/useClinical';
import { formatDateTime } from '../clinical/clinicalUtils';
import {
  useAnesthesiaListResource,
  useProcedureListResource,
} from '../shared/useClinicalDomainResource';
import {
  PROCEDURE_KIND_LABEL,
  PROCEDURE_STATUS_LABEL,
  procedureProfessionalName,
} from './procedureUtils';

const STATUS_LABEL = { DRAFT: 'Borrador', FINALIZED: 'Finalizado', VOIDED: 'Anulado' } as const;

function ProcedureList({ patientId, timezone }: { patientId: string; timezone: string }) {
  const [page, setPage] = useState(1);
  const canRead = useCan(PERMISSION.PROCEDURES_READ);
  const state = useProcedureListResource(patientId, page, canRead);
  if (!canRead) return null;
  if (state.loading)
    return (
      <Card>
        <LoadingState label="Cargando procedimientos" />
      </Card>
    );
  if (state.error)
    return (
      <Card>
        <ResourceError error={state.error} onRetry={state.reload} />
      </Card>
    );
  const data = state.data;
  return (
    <Card className="clinical-domain-list">
      <div className="detail-card__heading">
        <div>
          <p className="section-kicker">Procedimientos y cirugías</p>
          <h2>Procedimientos</h2>
        </div>
        <Badge>{`${data?.pagination.total ?? 0} registros`}</Badge>
      </div>
      {data?.data.length ? (
        <div className="clinical-domain-rows">
          {data.data.map((item) => (
            <ProcedureRow key={item.id} item={item} patientId={patientId} timezone={timezone} />
          ))}
        </div>
      ) : (
        <p className="clinical-muted">No hay procedimientos registrados.</p>
      )}
      <PaginationControls
        page={data?.pagination.page ?? 1}
        totalPages={data?.pagination.totalPages ?? 0}
        onChange={setPage}
      />
    </Card>
  );
}

function ProcedureRow({
  item,
  patientId,
  timezone,
}: {
  item: ClinicalProcedureSummary;
  patientId: string;
  timezone: string;
}) {
  return (
    <Link
      className="clinical-domain-row"
      to={`/pacientes/${patientId}/historia/procedimientos/${item.id}`}
    >
      <span className="clinical-domain-row__main">
        <strong>{item.procedureName || PROCEDURE_KIND_LABEL[item.kind]}</strong>
        <small>
          {PROCEDURE_KIND_LABEL[item.kind]} · {formatDateTime(item.performedAt, timezone)} ·{' '}
          {procedureProfessionalName(item)} · Consulta{' '}
          {item.encounter.status === 'VOIDED'
            ? 'anulada'
            : item.encounter.status === 'FINALIZED'
              ? 'finalizada'
              : 'en borrador'}
        </small>
      </span>
      <span className="clinical-domain-row__aside">
        <Badge
          tone={
            item.status === 'FINALIZED'
              ? 'success'
              : item.status === 'VOIDED'
                ? 'danger'
                : 'warning'
          }
        >
          {PROCEDURE_STATUS_LABEL[item.status]}
        </Badge>
        {item.parentEncounterStatus === 'VOIDED' ? (
          <small className="clinical-domain-warning">Consulta anulada</small>
        ) : null}
      </span>
    </Link>
  );
}

function AnesthesiaList({ patientId, timezone }: { patientId: string; timezone: string }) {
  const [page, setPage] = useState(1);
  const canRead = useCan(PERMISSION.ANESTHESIA_READ);
  const state = useAnesthesiaListResource(patientId, page, canRead);
  if (!canRead) return null;
  if (state.loading)
    return (
      <Card>
        <LoadingState label="Cargando registros anestésicos" />
      </Card>
    );
  if (state.error)
    return (
      <Card>
        <ResourceError error={state.error} onRetry={state.reload} />
      </Card>
    );
  const data = state.data;
  return (
    <Card className="clinical-domain-list">
      <div className="detail-card__heading">
        <div>
          <p className="section-kicker">Anestesia</p>
          <h2>Registros anestésicos</h2>
        </div>
        <Badge>{`${data?.pagination.total ?? 0} registros`}</Badge>
      </div>
      {data?.data.length ? (
        <div className="clinical-domain-rows">
          {data.data.map((item) => (
            <AnesthesiaRow key={item.id} item={item} patientId={patientId} timezone={timezone} />
          ))}
        </div>
      ) : (
        <p className="clinical-muted">No hay registros anestésicos registrados.</p>
      )}
      <PaginationControls
        page={data?.pagination.page ?? 1}
        totalPages={data?.pagination.totalPages ?? 0}
        onChange={setPage}
      />
    </Card>
  );
}

function AnesthesiaRow({
  item,
  patientId,
  timezone,
}: {
  item: AnesthesiaRecordSummary;
  patientId: string;
  timezone: string;
}) {
  const name =
    item.status === 'DRAFT'
      ? item.responsiblePractitioner?.displayName
      : item.professionalDisplayNameSnapshot;
  return (
    <Link
      className="clinical-domain-row"
      to={`/pacientes/${patientId}/historia/anestesias/${item.id}`}
    >
      <span className="clinical-domain-row__main">
        <strong>Registro anestésico</strong>
        <small>
          Inicio {formatDateTime(item.startedAt, timezone)}
          {item.endedAt ? ` · Fin ${formatDateTime(item.endedAt, timezone)}` : ''} ·{' '}
          {name?.trim() || 'Sin asignar'} ·{' '}
          {item.linkedProcedure
            ? `${item.linkedProcedure.procedureName || (item.linkedProcedure.kind === 'SURGERY' ? 'Cirugía' : 'Procedimiento')} · ${item.linkedProcedure.status === 'VOIDED' ? 'anulado' : item.linkedProcedure.status === 'FINALIZED' ? 'finalizado' : 'borrador'}`
            : 'Sin procedimiento asociado'}{' '}
          · Consulta{' '}
          {item.encounter.status === 'VOIDED'
            ? 'anulada'
            : item.encounter.status === 'FINALIZED'
              ? 'finalizada'
              : 'en borrador'}{' '}
          · {item.observationCount} lecturas
        </small>
      </span>
      <span className="clinical-domain-row__aside">
        <Badge
          tone={
            item.status === 'FINALIZED'
              ? 'success'
              : item.status === 'VOIDED'
                ? 'danger'
                : 'warning'
          }
        >
          {STATUS_LABEL[item.status]}
        </Badge>
        {item.parentEncounterStatus === 'VOIDED' ? (
          <small className="clinical-domain-warning">Consulta anulada</small>
        ) : item.linkedProcedureStatus === 'VOIDED' ? (
          <small className="clinical-domain-warning">Procedimiento anulado</small>
        ) : null}
      </span>
    </Link>
  );
}

// Combined page groups navigation while retaining separate permission checks and domain requests.
export function ProceduresAnesthesiaListPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const canReadProcedures = useCan(PERMISSION.PROCEDURES_READ);
  const canReadAnesthesia = useCan(PERMISSION.ANESTHESIA_READ);
  const organization = useClinicalOrganization();
  if (!patientId) return <ResourceError error={new Error('Paciente no encontrado.')} />;
  if (!canReadProcedures && !canReadAnesthesia)
    return <ResourceError error={new Error('No tienes permiso para consultar esta sección.')} />;
  return (
    <div className="page-stack clinical-page clinical-domain-page">
      <PageHeader
        eyebrow="Historia clínica"
        title="Procedimientos y anestesia"
        description="Registros clínicos de procedimientos, cirugías y anestesia del paciente."
        action={
          <Link className="button button--secondary" to={`/pacientes/${patientId}/historia`}>
            Volver a historia
          </Link>
        }
      />
      {organization.error ? (
        <Card>
          <ResourceError error={organization.error} onRetry={organization.reload} />
        </Card>
      ) : null}
      {canReadProcedures ? (
        <ProcedureList patientId={patientId} timezone={organization.data?.timezone ?? 'UTC'} />
      ) : null}
      {canReadAnesthesia ? (
        <AnesthesiaList patientId={patientId} timezone={organization.data?.timezone ?? 'UTC'} />
      ) : null}
    </div>
  );
}
