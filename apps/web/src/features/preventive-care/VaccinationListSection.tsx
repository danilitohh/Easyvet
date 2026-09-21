import { Link } from 'react-router-dom';
import { useState } from 'react';
import type { VaccinationSummary } from '@veterinary-saas/contracts';
import { useCan } from '../../auth/useCan';
import { PERMISSION } from '../../auth/permissions';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Badge } from '../../components/ui/Badge';
import { ResourceError, PaginationControls } from '../shared/ResourceFeedback';
import {
  administeredByDisplay,
  formatCivilDate,
  historicalPatientDisplay,
  professionalDisplay,
} from './preventiveUtils';
import { ParentEncounterNotice, PreventiveStatusBadge } from './PreventivePrimitives';
import { usePatientVaccinations } from './useVaccinations';

function VaccinationRow({
  vaccination,
  canReadEncounter,
}: {
  vaccination: VaccinationSummary;
  canReadEncounter: boolean;
}) {
  const professional = professionalDisplay(
    vaccination.status,
    vaccination.professionalDisplayNameSnapshot,
    vaccination.responsiblePractitioner?.displayName,
  );
  const administeredBy = administeredByDisplay(
    vaccination.status,
    vaccination.administeredByDisplayNameSnapshot,
    vaccination.administeredBy?.displayName,
  );
  return (
    <article className="preventive-list-row">
      <Link
        className="preventive-list-row__main"
        to={`/pacientes/${vaccination.patientId}/historia/preventivos/vacunas/${vaccination.id}`}
      >
        <span className="preventive-list-row__title">
          <strong>{vaccination.vaccineName || 'Vacunación sin nombre'}</strong>
          <PreventiveStatusBadge status={vaccination.status} />
          {vaccination.patient.status === 'ARCHIVED' ? (
            <Badge tone="warning">Paciente archivado</Badge>
          ) : null}
        </span>
        <span className="preventive-list-row__meta">
          {vaccination.administeredOn
            ? `Aplicación: ${formatCivilDate(vaccination.administeredOn)}`
            : 'Sin fecha de aplicación'}
          {vaccination.vaccineType ? ` · ${vaccination.vaccineType}` : ''}
          {` · ${historicalPatientDisplay(vaccination.status, vaccination.patientNameSnapshot, vaccination.patient.name)}`}
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
          {vaccination.nextDueOn ? (
            <div>
              <dt>Próxima dosis</dt>
              <dd>{formatCivilDate(vaccination.nextDueOn)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Consulta relacionada</dt>
            <dd>
              {canReadEncounter ? (
                <Link
                  to={`/pacientes/${vaccination.patientId}/historia/encuentros/${vaccination.clinicalEncounterId}`}
                >
                  {vaccination.encounter.status === 'VOIDED'
                    ? 'Anulada'
                    : vaccination.encounter.status === 'FINALIZED'
                      ? 'Finalizada'
                      : 'Borrador'}
                </Link>
              ) : vaccination.encounter.status === 'VOIDED' ? (
                'Anulada'
              ) : (
                'Consulta clínica'
              )}
            </dd>
          </div>
        </dl>
        <span className="preventive-list-row__arrow" aria-hidden="true">
          →
        </span>
      </div>
      {vaccination.parentEncounterStatus === 'VOIDED' ? (
        <div className="preventive-list-row__notice">
          <ParentEncounterNotice
            parentEncounterStatus={vaccination.parentEncounterStatus}
            status={vaccination.status}
          />
        </div>
      ) : null}
      {vaccination.status === 'DRAFT' ? (
        <p className="preventive-list-row__notice clinical-warning" role="status">
          Borrador — este registro preventivo aún no ha sido finalizado.
        </p>
      ) : null}
    </article>
  );
}

export function VaccinationListSection({
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
  const state = usePatientVaccinations(patientId, listOptions, true);

  if (state.loading) {
    return (
      <Card className="preventive-list-card">
        <LoadingState label="Cargando vacunaciones" />
      </Card>
    );
  }
  if (state.error) return <ResourceError error={state.error} onRetry={state.reload} />;
  const items = state.data?.data ?? [];
  const heading = clinicalEncounterId ? 'Vacunaciones de esta consulta' : 'Vacunación';

  return (
    <Card className="preventive-list-card">
      <div className="detail-card__heading">
        <div>
          <p className="section-kicker">Cuidado preventivo</p>
          <h2>{heading}</h2>
          {!compact ? (
            <p className="clinical-muted">
              Registros históricos de vacunas, sin operaciones desde esta vista.
            </p>
          ) : null}
        </div>
        {state.data?.pagination.total ? (
          <Badge>{`${state.data.pagination.total} registros`}</Badge>
        ) : null}
      </div>
      {items.length ? (
        <div className="preventive-list" aria-label="Vacunaciones">
          {items.map((item) => (
            <VaccinationRow key={item.id} vaccination={item} canReadEncounter={canReadEncounter} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Este paciente todavía no tiene registros de vacunación."
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
