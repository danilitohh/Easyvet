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
import { usePatient } from '../patients/usePatients';
import { ResourceError, StatusBadge } from '../shared/ResourceFeedback';
import {
  useClinicalEncounter,
  useClinicalEvolutions,
  useClinicalOrganization,
  useClinicalVitals,
} from './useClinical';
import {
  ENCOUNTER_STATUS_LABEL,
  evolutionHasContent,
  formatDateTime,
  ownerDisplayName,
  professionalDisplayName,
  statusTone,
  vitalValues,
} from './clinicalUtils';

function ReadonlyField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null;
  return (
    <div className="clinical-field">
      <dt>{label}</dt>
      <dd className="clinical-prose">{value}</dd>
    </div>
  );
}

export function ClinicalEncounterDetailPage() {
  const { patientId, encounterId } = useParams<{ patientId: string; encounterId: string }>();
  const canReadEncounter = useCan(PERMISSION.CLINICAL_ENCOUNTERS_READ);
  const canReadVitals = useCan(PERMISSION.CLINICAL_VITALS_READ);
  const canReadEvolutions = useCan(PERMISSION.CLINICAL_EVOLUTIONS_READ);
  const canReadAppointments = useCan(PERMISSION.APPOINTMENTS_READ);
  const canReadPatients = useCan(PERMISSION.PATIENTS_READ);
  const organization = useClinicalOrganization();
  const encounter = useClinicalEncounter(encounterId, canReadEncounter);
  const patientState = usePatient(canReadPatients ? encounter.data?.patientId : undefined);
  const vitals = useClinicalVitals(encounter.data?.id, canReadVitals && Boolean(encounter.data));
  const evolutions = useClinicalEvolutions(
    encounter.data?.patientId,
    1,
    canReadEvolutions && Boolean(encounter.data),
  );
  const timezone = organization.data?.timezone ?? 'UTC';

  if (encounter.loading || organization.loading)
    return (
      <div className="page-stack">
        <LoadingState label="Cargando encuentro clínico" />
      </div>
    );
  if (organization.error)
    return <ResourceError error={organization.error} onRetry={organization.reload} />;
  if (encounter.error) return <ResourceError error={encounter.error} onRetry={encounter.reload} />;
  if (!encounter.data || (patientId && encounter.data.patientId !== patientId))
    return (
      <ResourceError error={new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')} />
    );
  if (vitals.error) return <ResourceError error={vitals.error} onRetry={vitals.reload} />;
  if (evolutions.error)
    return <ResourceError error={evolutions.error} onRetry={evolutions.reload} />;
  const item = encounter.data;
  const relatedEvolutions = (evolutions.data?.data ?? []).filter(
    (evolution) => evolution.clinicalEncounterId === item.id && evolutionHasContent(evolution),
  );

  return (
    <div className="page-stack clinical-page">
      <PageHeader
        eyebrow="Encuentro clínico"
        title={item.reason}
        description={`${formatDateTime(item.occurredAt, timezone)} · ${item.patient.name}`}
        action={
          <Button as={Link} to={`/pacientes/${item.patientId}/historia`} variant="secondary">
            Volver a historia
          </Button>
        }
      />
      <Card className="clinical-encounter-header">
        <div className="clinical-encounter-header__top">
          <div>
            <p className="section-kicker">Estado del encuentro</p>
            <h2>{ENCOUNTER_STATUS_LABEL[item.status]}</h2>
          </div>
          <span className={`clinical-status clinical-status--${statusTone(item.status)}`}>
            {ENCOUNTER_STATUS_LABEL[item.status]}
          </span>
        </div>
        {item.status === 'DRAFT' ? (
          <p className="clinical-warning" role="status">
            Este encuentro está en borrador y puede estar incompleto.
          </p>
        ) : null}
        {item.status === 'VOIDED' ? (
          <p className="clinical-warning" role="status">
            Este encuentro fue anulado. Su información histórica se conserva sin permitir cambios.
          </p>
        ) : null}
        {item.status === 'FINALIZED' ? (
          <p className="clinical-muted">
            Finalizado {formatDateTime(item.finalizedAt, timezone)} ·{' '}
            {item.professionalDisplayNameSnapshot ?? professionalDisplayName(item)}
            {item.professionalLicenseSnapshot ? ` · ${item.professionalLicenseSnapshot}` : ''}
          </p>
        ) : null}
      </Card>
      <div className="detail-grid">
        <Card className="detail-card">
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Contexto histórico</p>
              <h2>Resumen</h2>
            </div>
            <StatusBadge status={item.patient.status} />
          </div>
          <dl className="detail-list">
            <div>
              <dt>Paciente actual</dt>
              <dd>
                {item.patient.name} · {item.patient.species}
              </dd>
            </div>
            <div>
              <dt>Propietario en el encuentro</dt>
              <dd>
                {ownerDisplayName(item.historicalOwner)}
                <span className="inline-note">Snapshot histórico</span>
              </dd>
            </div>
            <div>
              <dt>Ubicación</dt>
              <dd>{item.clinicLocation.name}</dd>
            </div>
            <div>
              <dt>Profesional responsable</dt>
              <dd>
                {professionalDisplayName(item)}
                {item.professionalLicenseSnapshot ? (
                  <span className="inline-note">{item.professionalLicenseSnapshot}</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Fecha y hora</dt>
              <dd>{formatDateTime(item.occurredAt, timezone)}</dd>
            </div>
            {patientState.patient?.currentWeightKg ? (
              <div>
                <dt>Peso actual del paciente</dt>
                <dd>
                  {patientState.patient.currentWeightKg} kg
                  <span className="inline-note">
                    Dato actual; las mediciones abajo son históricas
                  </span>
                </dd>
              </div>
            ) : null}
            {canReadAppointments && item.appointment ? (
              <div>
                <dt>Cita asociada</dt>
                <dd>
                  <Link to={`/agenda/citas/${item.appointment.id}`}>
                    {item.appointment.reason} ·{' '}
                    {formatDateTime(item.appointment.startsAt, timezone)}
                  </Link>
                </dd>
              </div>
            ) : null}
            {item.status === 'VOIDED' && item.voidReason ? (
              <div>
                <dt>Motivo de anulación</dt>
                <dd className="clinical-prose">{item.voidReason}</dd>
              </div>
            ) : null}
          </dl>
        </Card>
        <Card className="detail-card">
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Narrativa clínica</p>
              <h2>Evaluación</h2>
            </div>
          </div>
          <dl className="clinical-fields">
            <ReadonlyField label="Anamnesis" value={item.anamnesis} />
            <ReadonlyField label="Examen físico" value={item.physicalExam} />
            <ReadonlyField label="Diagnóstico presuntivo" value={item.presumptiveDiagnosis} />
            <ReadonlyField label="Diagnóstico diferencial" value={item.differentialDiagnosis} />
            <ReadonlyField label="Diagnóstico definitivo" value={item.definitiveDiagnosis} />
          </dl>
        </Card>
      </div>
      <Card className="detail-card">
        <div className="detail-card__heading">
          <div>
            <p className="section-kicker">Plan y recomendaciones</p>
            <h2>Continuidad de atención</h2>
          </div>
        </div>
        <dl className="clinical-fields">
          <ReadonlyField label="Plan diagnóstico" value={item.diagnosticPlan} />
          <ReadonlyField label="Plan terapéutico" value={item.therapeuticPlan} />
          <ReadonlyField label="Recomendaciones" value={item.recommendations} />
          <ReadonlyField label="Seguimiento" value={item.followUpPlan} />
          <ReadonlyField label="Notas" value={item.notes} />
        </dl>
      </Card>
      {canReadVitals ? (
        <Card className="detail-card">
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Mediciones</p>
              <h2>Signos vitales</h2>
            </div>
          </div>
          {vitals.loading ? (
            <LoadingState label="Cargando signos vitales" />
          ) : vitals.vitals.length ? (
            <div className="clinical-vitals">
              {[...vitals.vitals]
                .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())
                .map((vital) => (
                  <article className="clinical-vital" key={vital.id}>
                    <strong>{formatDateTime(vital.measuredAt, timezone)}</strong>
                    <dl>
                      {vitalValues(vital).map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd className="clinical-prose">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <small>
                      El peso de esta medición es histórico; no reemplaza el peso actual del
                      paciente.
                    </small>
                  </article>
                ))}
            </div>
          ) : (
            <EmptyState
              title="Sin signos vitales registrados"
              description="Este encuentro no tiene mediciones para mostrar."
            />
          )}
        </Card>
      ) : null}
      {canReadEvolutions ? (
        <Card className="detail-card">
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Evoluciones</p>
              <h2>Notas relacionadas</h2>
            </div>
            <Badge>{`${relatedEvolutions.length} notas`}</Badge>
          </div>
          {evolutions.loading ? (
            <LoadingState label="Cargando evoluciones" />
          ) : relatedEvolutions.length ? (
            relatedEvolutions.map((evolution) => (
              <article className="clinical-note" key={evolution.id}>
                <strong>{formatDateTime(evolution.occurredAt, timezone)}</strong>
                {evolution.subjective ? (
                  <p>
                    <b>Subjetivo:</b> {evolution.subjective}
                  </p>
                ) : null}
                {evolution.objective ? (
                  <p>
                    <b>Objetivo:</b> {evolution.objective}
                  </p>
                ) : null}
                {evolution.assessment ? (
                  <p>
                    <b>Valoración:</b> {evolution.assessment}
                  </p>
                ) : null}
                {evolution.plan ? (
                  <p>
                    <b>Plan:</b> {evolution.plan}
                  </p>
                ) : null}
              </article>
            ))
          ) : (
            <EmptyState
              title="Sin evoluciones relacionadas"
              description="No hay notas de evolución vinculadas a este encuentro."
            />
          )}
        </Card>
      ) : null}
    </div>
  );
}
