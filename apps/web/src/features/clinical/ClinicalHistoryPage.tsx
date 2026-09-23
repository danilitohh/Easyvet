import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { useAuth } from '../../contexts/useAuth';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';
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
  useProfessionalProfile,
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

function ProceduresAnesthesiaEntry({ patientId }: { patientId: string }) {
  const canReadProcedures = useCan(PERMISSION.PROCEDURES_READ);
  const canReadAnesthesia = useCan(PERMISSION.ANESTHESIA_READ);
  if (!canReadProcedures && !canReadAnesthesia) return null;
  return (
    <Card className="prescription-history-entry clinical-domain-history-entry">
      <div>
        <p className="section-kicker">Procedimientos y anestesia</p>
        <h2>Procedimientos y anestesia</h2>
        <p className="clinical-muted">
          Consulta procedimientos, cirugías y registros anestésicos con su historial de
          monitorización.
        </p>
      </div>
      <Button as={Link} to={`/pacientes/${patientId}/historia/procedimientos`} variant="secondary">
        Ver{' '}
        {canReadProcedures && canReadAnesthesia
          ? 'procedimientos y anestesia'
          : canReadProcedures
            ? 'procedimientos'
            : 'anestesia'}
      </Button>
    </Card>
  );
}

// Exposes hospitalization history independently from access to general clinical-record content.
function HospitalizationHistoryEntry({ patientId }: { patientId: string }) {
  const canRead = useCan(PERMISSION.HOSPITALIZATIONS_READ);
  if (!canRead) return null;
  return (
    <Card className="prescription-history-entry clinical-domain-history-entry">
      <div>
        <p className="section-kicker">Cuidado intrahospitalario</p>
        <h2>Hospitalizaciones</h2>
        <p className="clinical-muted">
          Consulta ingresos, plan de cuidado, registros cronológicos y altas del paciente.
        </p>
      </div>
      <Button
        as={Link}
        to={`/pacientes/${patientId}/historia/hospitalizaciones`}
        variant="secondary"
      >
        Ver hospitalizaciones
      </Button>
    </Card>
  );
}

// Keeps diagnostic history discoverable without requiring access to the full clinical record.
function DiagnosticHistoryEntry({ patientId }: { patientId: string }) {
  const canRead = useCan(PERMISSION.DIAGNOSTICS_READ);
  if (!canRead) return null;
  return (
    <Card className="prescription-history-entry clinical-domain-history-entry">
      <div>
        <p className="section-kicker">Diagnósticos</p>
        <h2>Diagnósticos y exámenes</h2>
        <p className="clinical-muted">
          Consulta solicitudes, resultados y el contexto histórico de cada estudio.
        </p>
      </div>
      <Button as={Link} to={`/pacientes/${patientId}/historia/diagnosticos`} variant="secondary">
        Ver diagnósticos y exámenes
      </Button>
    </Card>
  );
}

// Keeps documents and signed evidence discoverable without changing the record timeline itself.
function DocumentsHistoryEntry({ patientId }: { patientId: string }) {
  const canRead = useCan(PERMISSION.DOCUMENTS_READ);
  if (!canRead) return null;
  return (
    <Card className="prescription-history-entry clinical-domain-history-entry">
      <div>
        <p className="section-kicker">Archivo clínico</p>
        <h2>Documentos</h2>
        <p className="clinical-muted">
          Consulta PDFs generados, adjuntos y evidencia histórica del paciente.
        </p>
      </div>
      <Button as={Link} to={`/pacientes/${patientId}/historia/documentos`} variant="secondary">
        Ver documentos
      </Button>
    </Card>
  );
}

// Gives the patient history a dedicated consent route while creation remains bound to an encounter.
function ConsentsHistoryEntry({ patientId }: { patientId: string }) {
  const canRead = useCan(PERMISSION.CONSENTS_READ);
  if (!canRead) return null;
  return (
    <Card className="prescription-history-entry clinical-domain-history-entry">
      <div>
        <p className="section-kicker">Consentimiento informado</p>
        <h2>Consentimientos</h2>
        <p className="clinical-muted">
          Consulta borradores, estado de firma y evidencia electrónica conservada.
        </p>
      </div>
      <Button as={Link} to={`/pacientes/${patientId}/historia/consentimientos`} variant="secondary">
        Ver consentimientos
      </Button>
    </Card>
  );
}

// Follow-up history has independent permission and remains accessible without the full clinical record.
function FollowUpsHistoryEntry({ patientId }: { patientId: string }) {
  const canRead = useCan(PERMISSION.FOLLOW_UPS_READ);
  if (!canRead) return null;
  return (
    <Card className="prescription-history-entry clinical-domain-history-entry">
      <div>
        <p className="section-kicker">Continuidad del cuidado</p>
        <h2>Seguimientos</h2>
        <p className="clinical-muted">
          Consulta tareas abiertas, resultados y anulaciones conservadas en el historial.
        </p>
      </div>
      <Button as={Link} to={`/pacientes/${patientId}/historia/seguimientos`} variant="secondary">
        Ver seguimientos
      </Button>
    </Card>
  );
}

export function ClinicalHistoryPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const canReadRecord = useCan(PERMISSION.CLINICAL_RECORDS_READ);
  const canReadEncounters = useCan(PERMISSION.CLINICAL_ENCOUNTERS_READ);
  const canReadEvolutions = useCan(PERMISSION.CLINICAL_EVOLUTIONS_READ);
  const canReadPrescriptions = useCan(PERMISSION.PRESCRIPTIONS_READ);
  const canReadVaccinations = useCan(PERMISSION.VACCINATIONS_READ);
  const canReadDewormings = useCan(PERMISSION.DEWORMINGS_READ);
  const canReadProcedures = useCan(PERMISSION.PROCEDURES_READ);
  const canReadAnesthesia = useCan(PERMISSION.ANESTHESIA_READ);
  const canReadHospitalizations = useCan(PERMISSION.HOSPITALIZATIONS_READ);
  const canReadDiagnostics = useCan(PERMISSION.DIAGNOSTICS_READ);
  const canReadDocuments = useCan(PERMISSION.DOCUMENTS_READ);
  const canReadConsents = useCan(PERMISSION.CONSENTS_READ);
  const canReadFollowUps = useCan(PERMISSION.FOLLOW_UPS_READ);
  const canCreateEncounter = useCan(PERMISSION.CLINICAL_ENCOUNTERS_CREATE);
  const canCreateEvolution = useCan(PERMISSION.CLINICAL_EVOLUTIONS_CREATE);
  const { activeMembership } = useAuth();
  const organization = useClinicalOrganization();
  const recordState = useClinicalRecord(patientId, canReadRecord);
  const patientState = usePatient(canReadRecord ? patientId : undefined);
  const profile = useProfessionalProfile(
    canReadRecord && activeMembership?.clinicalRole === 'PRACTITIONER',
  );
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
  if (!canReadRecord) {
    return (
      <div className="page-stack clinical-page">
        <PageHeader
          eyebrow="Historia clínica"
          title="Historia clínica"
          description="Acceso a los módulos clínicos habilitados para tu membresía."
          action={
            <Button as={Link} to={`/pacientes/${patientId}`} variant="secondary">
              Volver al paciente
            </Button>
          }
        />
        {canReadProcedures || canReadAnesthesia ? (
          <ProceduresAnesthesiaEntry patientId={patientId} />
        ) : null}
        {canReadHospitalizations ? <HospitalizationHistoryEntry patientId={patientId} /> : null}
        {canReadDiagnostics ? <DiagnosticHistoryEntry patientId={patientId} /> : null}
        {canReadDocuments ? <DocumentsHistoryEntry patientId={patientId} /> : null}
        {canReadConsents ? <ConsentsHistoryEntry patientId={patientId} /> : null}
        {canReadFollowUps ? <FollowUpsHistoryEntry patientId={patientId} /> : null}
        {canReadPrescriptions ? (
          <Card className="prescription-history-entry">
            <div>
              <p className="section-kicker">Tratamientos</p>
              <h2>Prescripciones</h2>
            </div>
            <Button
              as={Link}
              to={`/pacientes/${patientId}/historia/prescripciones`}
              variant="secondary"
            >
              Ver prescripciones
            </Button>
          </Card>
        ) : null}
        {canReadVaccinations || canReadDewormings ? (
          <Card className="prescription-history-entry">
            <div>
              <p className="section-kicker">Cuidado preventivo</p>
              <h2>Vacunaciones y desparasitaciones</h2>
            </div>
            <Button
              as={Link}
              to={`/pacientes/${patientId}/historia/preventivos`}
              variant="secondary"
            >
              Ver cuidado preventivo
            </Button>
          </Card>
        ) : null}
        {canReadEncounters || canReadEvolutions ? (
          <Card>
            <EmptyState
              title="Historia clínica restringida"
              description="El detalle del expediente y de los encuentros requiere un permiso clínico independiente."
            />
          </Card>
        ) : null}
      </div>
    );
  }
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
            <span className="page-header__actions">
              {canCreateEncounter && patientState.patient?.status === 'ACTIVE' ? (
                <Button as={Link} to={`/pacientes/${patientId}/historia/nueva`}>
                  Nueva consulta
                </Button>
              ) : null}
              <Button as={Link} to={`/pacientes/${patientId}`} variant="secondary">
                Volver al paciente
              </Button>
            </span>
          }
        />
        {canReadProcedures || canReadAnesthesia ? (
          <ProceduresAnesthesiaEntry patientId={patientId} />
        ) : null}
        {canReadHospitalizations ? <HospitalizationHistoryEntry patientId={patientId} /> : null}
        {canReadDiagnostics ? <DiagnosticHistoryEntry patientId={patientId} /> : null}
        {canReadDocuments ? <DocumentsHistoryEntry patientId={patientId} /> : null}
        {canReadConsents ? <ConsentsHistoryEntry patientId={patientId} /> : null}
        {canReadFollowUps ? <FollowUpsHistoryEntry patientId={patientId} /> : null}
        <Card>
          <EmptyState
            title="Este paciente todavía no tiene historia clínica."
            description="Puedes iniciar una consulta en borrador para crear su historia clínica."
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
          <span className="page-header__actions">
            {canCreateEncounter && patientState.patient?.status === 'ACTIVE' ? (
              <Button as={Link} to={`/pacientes/${patientId}/historia/nueva`}>
                Nueva consulta
              </Button>
            ) : null}
            {canCreateEvolution && patientState.patient?.status === 'ACTIVE' ? (
              <Button as={Link} to={`/pacientes/${patientId}/historia/evoluciones/nueva`}>
                Nueva evolución general
              </Button>
            ) : null}
            <Button as={Link} to={`/pacientes/${patientId}`} variant="secondary">
              Volver al paciente
            </Button>
          </span>
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
      {activeMembership?.clinicalRole === 'PRACTITIONER' &&
      profile.data &&
      !profile.data.displayName.trim() ? (
        <Alert tone="warning" role="status">
          Completa tu perfil profesional antes de poder finalizar consultas.{' '}
          <Link to="/perfil/profesional">Configurar perfil profesional</Link>
        </Alert>
      ) : null}
      {canReadPrescriptions ? (
        <Card className="prescription-history-entry">
          <div>
            <p className="section-kicker">Tratamientos</p>
            <h2>Prescripciones</h2>
            <p className="clinical-muted">
              Consulta las indicaciones históricas del paciente, sus items y el estado de la
              consulta relacionada.
            </p>
          </div>
          <Button
            as={Link}
            to={`/pacientes/${patientId}/historia/prescripciones`}
            variant="secondary"
          >
            Ver prescripciones
          </Button>
        </Card>
      ) : null}
      {canReadVaccinations || canReadDewormings ? (
        <Card className="prescription-history-entry preventive-history-entry">
          <div>
            <p className="section-kicker">Cuidado preventivo</p>
            <h2>Vacunaciones y desparasitaciones</h2>
            <p className="clinical-muted">
              Consulta el historial preventivo con estados, fechas civiles y snapshots históricos.
            </p>
          </div>
          <Button as={Link} to={`/pacientes/${patientId}/historia/preventivos`} variant="secondary">
            Ver cuidado preventivo
          </Button>
        </Card>
      ) : null}
      {canReadProcedures || canReadAnesthesia ? (
        <ProceduresAnesthesiaEntry patientId={patientId} />
      ) : null}
      {canReadHospitalizations ? <HospitalizationHistoryEntry patientId={patientId} /> : null}
      {canReadDiagnostics ? <DiagnosticHistoryEntry patientId={patientId} /> : null}
      {canReadDocuments ? <DocumentsHistoryEntry patientId={patientId} /> : null}
      {canReadConsents ? <ConsentsHistoryEntry patientId={patientId} /> : null}
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
                <strong>
                  {formatDateTime(item.occurredAt, timezone)} ·{' '}
                  {item.authorDisplayName ?? 'Profesional clínico'}
                </strong>
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
