import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { ApiError } from '../../services/apiClient';
import { ResourceError, StatusBadge, PaginationControls } from '../shared/ResourceFeedback';
import { usePatient } from '../patients/usePatients';
import {
  useClinicalEncounters,
  useClinicalEvolutions,
  useClinicalOrganization,
  useClinicalRecord,
} from './useClinical';
import {
  ENCOUNTER_STATUS_LABEL,
  formatDateTime,
  ownerDisplayName,
  professionalDisplayName,
  statusTone,
} from './clinicalUtils';

function PatientHeader({
  patientId,
  historicalSummary,
}: {
  patientId: string;
  historicalSummary: { name: string; species: string; status: 'ACTIVE' | 'ARCHIVED' } | undefined;
}) {
  const canReadPatients = useCan(PERMISSION.PATIENTS_READ);
  const patientState = usePatient(canReadPatients ? patientId : undefined);
  if (patientState.loading) return <LoadingState label="Cargando resumen del paciente" />;
  if (patientState.patient) {
    return (
      <div className="clinical-patient-summary">
        <div>
          <p className="section-kicker">Paciente</p>
          <h2>{patientState.patient.name}</h2>
          <p>
            {patientState.patient.species}
            {patientState.patient.breed ? ` · ${patientState.patient.breed}` : ''}
          </p>
        </div>
        <StatusBadge status={patientState.patient.status} />
      </div>
    );
  }
  if (historicalSummary) {
    return (
      <div className="clinical-patient-summary">
        <div>
          <p className="section-kicker">Paciente</p>
          <h2>{historicalSummary.name}</h2>
          <p>{historicalSummary.species}</p>
        </div>
        <StatusBadge status={historicalSummary.status} />
      </div>
    );
  }
  // Clinical permissions are independent from patients.read; an encounter can still supply identity.
  return <span className="clinical-muted">Paciente {patientId}</span>;
}

export function ClinicalHistoryPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const canReadRecord = useCan(PERMISSION.CLINICAL_RECORDS_READ);
  const canReadEncounters = useCan(PERMISSION.CLINICAL_ENCOUNTERS_READ);
  const canReadEvolutions = useCan(PERMISSION.CLINICAL_EVOLUTIONS_READ);
  const organization = useClinicalOrganization();
  const recordState = useClinicalRecord(patientId, canReadRecord);
  const [page, setPage] = useState(1);
  const [evolutionPage, setEvolutionPage] = useState(1);
  const encounters = useClinicalEncounters(
    patientId,
    page,
    canReadEncounters && Boolean(recordState.record),
  );
  const evolutions = useClinicalEvolutions(
    patientId,
    evolutionPage,
    canReadEvolutions && Boolean(recordState.record),
  );
  const timezone = organization.data?.timezone ?? 'UTC';

  if (!patientId) return <ResourceError error={new ApiError('Paciente no encontrado', 404)} />;
  if (recordState.loading) {
    return (
      <div className="page-stack">
        <LoadingState label="Cargando historia clínica" />
      </div>
    );
  }
  if (recordState.error)
    return <ResourceError error={recordState.error} onRetry={recordState.reload} />;
  if (!recordState.record) {
    return (
      <div className="page-stack">
        <PageHeader
          eyebrow="Historia clínica"
          title="Historia clínica"
          description="Lectura segura del registro clínico del paciente."
          action={
            <Button as={Link} to={`/pacientes/${patientId}`} variant="secondary">
              Volver al paciente
            </Button>
          }
        />
        <Card>
          <EmptyState
            title="Este paciente todavía no tiene historia clínica."
            description="La historia aparecerá cuando exista un registro clínico para este paciente."
          />
        </Card>
      </div>
    );
  }
  if (organization.loading) {
    return (
      <div className="page-stack">
        <LoadingState label="Cargando zona horaria de la organización" />
      </div>
    );
  }
  if (organization.error)
    return <ResourceError error={organization.error} onRetry={organization.reload} />;
  if (encounters.error)
    return <ResourceError error={encounters.error} onRetry={encounters.reload} />;
  if (evolutions.error)
    return <ResourceError error={evolutions.error} onRetry={evolutions.reload} />;

  return (
    <div className="page-stack clinical-page">
      <PageHeader
        eyebrow="Historia clínica"
        title="Historia clínica"
        description="Registro longitudinal en modo lectura."
        action={
          <Button as={Link} to={`/pacientes/${patientId}`} variant="secondary">
            Volver al paciente
          </Button>
        }
      />
      <Card className="clinical-summary-card">
        <PatientHeader
          patientId={patientId}
          historicalSummary={encounters.data?.data[0]?.patient}
        />
        <p className="clinical-meta">
          Creada {formatDateTime(recordState.record.createdAt, timezone)} · Actualizada{' '}
          {formatDateTime(recordState.record.updatedAt, timezone)} ·{' '}
          {recordState.record.encounterCount ?? 0} encuentros
        </p>
      </Card>
      {!canReadEncounters ? (
        <Card>
          <EmptyState
            title="Encuentros clínicos restringidos"
            description="Tu membresía no tiene permiso para leer los encuentros de esta historia."
          />
        </Card>
      ) : encounters.loading ? (
        <Card>
          <LoadingState label="Cargando encuentros clínicos" />
        </Card>
      ) : encounters.data?.data.length ? (
        <Card className="clinical-list-card">
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Línea de tiempo</p>
              <h2>Encuentros clínicos</h2>
            </div>
            <Badge>{`${encounters.data.pagination.total} registros`}</Badge>
          </div>
          <div className="clinical-encounter-list">
            {encounters.data.data.map((encounter) => (
              <Link
                className="clinical-encounter-row"
                key={encounter.id}
                to={`/pacientes/${patientId}/historia/encuentros/${encounter.id}`}
              >
                <span>
                  <strong>{formatDateTime(encounter.occurredAt, timezone)}</strong>
                  <small>
                    {encounter.reason} · {professionalDisplayName(encounter)}
                  </small>
                  <small>
                    Propietario histórico: {ownerDisplayName(encounter.historicalOwner)}
                  </small>
                </span>
                <span
                  className={`clinical-status clinical-status--${statusTone(encounter.status)}`}
                >
                  {ENCOUNTER_STATUS_LABEL[encounter.status]}
                </span>
              </Link>
            ))}
          </div>
          <PaginationControls
            page={encounters.data.pagination.page}
            totalPages={encounters.data.pagination.totalPages}
            onChange={setPage}
          />
        </Card>
      ) : (
        <Card>
          <EmptyState
            title="No hay encuentros clínicos"
            description="El registro existe, pero todavía no contiene encuentros para mostrar."
          />
        </Card>
      )}
      {canReadEvolutions &&
      evolutions.data?.data.some((item) => item.clinicalEncounterId === null) ? (
        <Card className="clinical-record-evolutions">
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Evolución del paciente</p>
              <h2>Notas de evolución sin encuentro</h2>
            </div>
          </div>
          {evolutions.data.data
            .filter((item) => item.clinicalEncounterId === null)
            .map((item) => (
              <article className="clinical-note" key={item.id}>
                <strong>{formatDateTime(item.occurredAt, timezone)}</strong>
                {item.subjective ? (
                  <p>
                    <b>Subjetivo:</b> {item.subjective}
                  </p>
                ) : null}
                {item.objective ? (
                  <p>
                    <b>Objetivo:</b> {item.objective}
                  </p>
                ) : null}
                {item.assessment ? (
                  <p>
                    <b>Valoración:</b> {item.assessment}
                  </p>
                ) : null}
                {item.plan ? (
                  <p>
                    <b>Plan:</b> {item.plan}
                  </p>
                ) : null}
              </article>
            ))}
          <PaginationControls
            page={evolutions.data.pagination.page}
            totalPages={evolutions.data.pagination.totalPages}
            onChange={setEvolutionPage}
          />
        </Card>
      ) : null}
    </div>
  );
}
