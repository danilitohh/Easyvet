import { Link } from 'react-router-dom';
import { useState } from 'react';
import type { DewormingSummary } from '@veterinary-saas/contracts';
import { useCan } from '../../auth/useCan';
import { PERMISSION } from '../../auth/permissions';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Badge } from '../../components/ui/Badge';
import { EasyvetIcon } from '../../components/icons/EasyvetIcon';
import { ResourceError, PaginationControls } from '../shared/ResourceFeedback';
import {
  administeredByDisplay,
  formatCivilDate,
  historicalPatientDisplay,
  professionalDisplay,
} from './preventiveUtils';
import { ParentEncounterNotice, PreventiveStatusBadge } from './PreventivePrimitives';
import { usePatientDewormings } from './useDewormings';

function DewormingRow({
  deworming,
  canReadEncounter,
}: {
  deworming: DewormingSummary;
  canReadEncounter: boolean;
}) {
  const professional = professionalDisplay(
    deworming.status,
    deworming.professionalDisplayNameSnapshot,
    deworming.responsiblePractitioner?.displayName,
  );
  const administeredBy = administeredByDisplay(
    deworming.status,
    deworming.administeredByDisplayNameSnapshot,
    deworming.administeredBy?.displayName,
  );
  return (
    <article className="preventive-list-row">
      <Link
        className="preventive-list-row__main"
        to={`/pacientes/${deworming.patientId}/historia/preventivos/desparasitaciones/${deworming.id}`}
      >
        <span className="preventive-list-row__title">
          <strong>{deworming.productName || 'Desparasitación sin producto'}</strong>
          <PreventiveStatusBadge status={deworming.status} />
          {deworming.patient.status === 'ARCHIVED' ? (
            <Badge tone="warning">Paciente archivado</Badge>
          ) : null}
        </span>
        <span className="preventive-list-row__meta">
          {deworming.administeredOn
            ? `Aplicación: ${formatCivilDate(deworming.administeredOn)}`
            : 'Sin fecha de aplicación'}
          {deworming.dewormingType ? ` · ${deworming.dewormingType}` : ''}
          {` · ${historicalPatientDisplay(deworming.status, deworming.patientNameSnapshot, deworming.patient.name)}`}
        </span>
      </Link>
      <div className="preventive-list-row__aside">
        <dl className="preventive-list-row__facts">
          <div>
            <dt>Profesional responsable</dt>
            <dd>{professional}</dd>
          </div>
          {administeredBy ? (
            <div>
              <dt>Administrado por</dt>
              <dd>{administeredBy}</dd>
            </div>
          ) : null}
          {deworming.nextDueOn ? (
            <div>
              <dt>Próxima desparasitación</dt>
              <dd>{formatCivilDate(deworming.nextDueOn)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Consulta relacionada</dt>
            <dd>
              {canReadEncounter ? (
                <Link
                  to={`/pacientes/${deworming.patientId}/historia/encuentros/${deworming.clinicalEncounterId}`}
                >
                  {deworming.encounter.status === 'VOIDED'
                    ? 'Anulada'
                    : deworming.encounter.status === 'FINALIZED'
                      ? 'Finalizada'
                      : 'Borrador'}
                </Link>
              ) : deworming.encounter.status === 'VOIDED' ? (
                'Anulada'
              ) : (
                'Consulta clínica'
              )}
            </dd>
          </div>
        </dl>
        <span className="preventive-list-row__arrow" aria-hidden="true">
          <EasyvetIcon name="arrow-right" size={16} />
        </span>
      </div>
      {deworming.parentEncounterStatus === 'VOIDED' ? (
        <div className="preventive-list-row__notice">
          <ParentEncounterNotice
            parentEncounterStatus={deworming.parentEncounterStatus}
            status={deworming.status}
          />
        </div>
      ) : null}
      {deworming.status === 'DRAFT' ? (
        <p className="preventive-list-row__notice clinical-warning" role="status">
          Borrador — este registro preventivo aún no ha sido finalizado.
        </p>
      ) : null}
    </article>
  );
}

export function DewormingListSection({
  patientId,
  timezone: _timezone,
  clinicalEncounterId,
  compact = false,
}: {
  patientId: string;
  timezone: string;
  clinicalEncounterId?: string;
  compact?: boolean;
}) {
  const canReadEncounter = useCan(PERMISSION.CLINICAL_ENCOUNTERS_READ);
  const [page, setPage] = useState(1);
  const listOptions = clinicalEncounterId ? { page, clinicalEncounterId } : { page };
  const state = usePatientDewormings(patientId, listOptions, true);

  if (state.loading) {
    return (
      <Card className="preventive-list-card">
        <LoadingState label="Cargando desparasitaciones" />
      </Card>
    );
  }
  if (state.error) return <ResourceError error={state.error} onRetry={state.reload} />;
  const items = state.data?.data ?? [];
  const heading = clinicalEncounterId ? 'Desparasitaciones de esta consulta' : 'Desparasitación';

  return (
    <Card className="preventive-list-card">
      <div className="detail-card__heading">
        <div>
          <p className="section-kicker">Cuidado preventivo</p>
          <h2>{heading}</h2>
          {!compact ? (
            <p className="clinical-muted">
              Registros históricos de control antiparasitario, sin operaciones desde esta vista.
            </p>
          ) : null}
        </div>
        {state.data?.pagination.total ? (
          <Badge>{`${state.data.pagination.total} registros`}</Badge>
        ) : null}
      </div>
      {items.length ? (
        <div className="preventive-list" aria-label="Desparasitaciones">
          {items.map((item) => (
            <DewormingRow key={item.id} deworming={item} canReadEncounter={canReadEncounter} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Este paciente todavía no tiene registros de desparasitación."
          description="Cuando exista un registro preventivo, aparecerá aquí como evidencia clínica de solo lectura."
        />
      )}
      {state.data?.pagination ? (
        <PaginationControls
          page={state.data.pagination.page}
          totalPages={state.data.pagination.totalPages}
          onChange={setPage}
        />
      ) : null}
    </Card>
  );
}
