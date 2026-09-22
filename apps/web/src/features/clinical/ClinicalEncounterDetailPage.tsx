import { Link, useParams } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { EncounterProcedureSections } from '../procedures/EncounterProcedureSections';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { TextInput } from '../../components/ui/TextInput';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { ApiError } from '../../services/apiClient';
import { usePatient } from '../patients/usePatients';
import { useAuth } from '../../contexts/useAuth';
import { clinicalApi } from './clinicalApi';
import { createClinicalVitalRequestSchema } from '@veterinary-saas/contracts';
import { civilFieldsFromInstant, instantFromCivil } from '../agenda/agendaUtils';
import { errorMessage } from '../shared/resourceUtils';
import { ResourceError, StatusBadge } from '../shared/ResourceFeedback';
import {
  useClinicalEncounter,
  useClinicalEvolutions,
  useClinicalOrganization,
  useClinicalVitals,
  useProfessionalProfile,
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
import { PrescriptionListSection } from '../prescriptions/PrescriptionListSection';
import { VaccinationListSection } from '../preventive-care/VaccinationListSection';
import { DewormingListSection } from '../preventive-care/DewormingListSection';
import { useHospitalizationListResource } from '../shared/useClinicalDomainResource';
import { DiagnosticEncounterSection } from '../diagnostics/DiagnosticEncounterSection';
import { ConsentEncounterSection } from '../documents/ConsentsPage';

function ReadonlyField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null;
  return (
    <div className="clinical-field">
      <dt>{label}</dt>
      <dd className="clinical-prose">{value}</dd>
    </div>
  );
}

function DraftVitalForm({
  encounterId,
  timezone,
  onSaved,
}: {
  encounterId: string;
  timezone: string;
  onSaved: () => void;
}) {
  const now = civilFieldsFromInstant(new Date().toISOString(), timezone);
  const [measuredAt, setMeasuredAt] = useState(`${now.date}T${now.time}`);
  const [weightKg, setWeightKg] = useState('');
  const [temperatureC, setTemperatureC] = useState('');
  const [heartRateBpm, setHeartRateBpm] = useState('');
  const [respiratoryRateBpm, setRespiratoryRateBpm] = useState('');
  const [observations, setObservations] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const [date, time] = measuredAt.split('T');
    const payload = {
      measuredAt: instantFromCivil(date ?? '', time ?? '', timezone),
      weightKg: weightKg ? Number(weightKg) : null,
      temperatureC: temperatureC ? Number(temperatureC) : null,
      heartRateBpm: heartRateBpm ? Number(heartRateBpm) : null,
      respiratoryRateBpm: respiratoryRateBpm ? Number(respiratoryRateBpm) : null,
      observations: observations.trim() || null,
    };
    const parsed = createClinicalVitalRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setError(new ApiError('Revisa los valores de la medición.', 400));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await clinicalApi.addVital(encounterId, parsed.data);
      onSaved();
      setWeightKg('');
      setTemperatureC('');
      setHeartRateBpm('');
      setRespiratoryRateBpm('');
      setObservations('');
    } catch (requestError: unknown) {
      setError(requestError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="domain-form clinical-vital-form" onSubmit={(event) => void submit(event)}>
      {error ? (
        <Alert tone="error" role="alert">
          {errorMessage(error, 'No fue posible registrar la medición.')}
        </Alert>
      ) : null}
      <div className="form-grid form-grid--three">
        <FormField
          label="Medición *"
          htmlFor="vital-measured-at"
          hint={`Zona horaria: ${timezone}`}
        >
          <TextInput
            id="vital-measured-at"
            type="datetime-local"
            value={measuredAt}
            onChange={(event) => setMeasuredAt(event.target.value)}
            required
          />
        </FormField>
        <FormField label="Peso (kg)" htmlFor="vital-weight">
          <TextInput
            id="vital-weight"
            type="number"
            min="0.001"
            step="0.001"
            value={weightKg}
            onChange={(event) => setWeightKg(event.target.value)}
          />
        </FormField>
        <FormField label="Temperatura (°C)" htmlFor="vital-temperature">
          <TextInput
            id="vital-temperature"
            type="number"
            min="0.001"
            step="0.1"
            value={temperatureC}
            onChange={(event) => setTemperatureC(event.target.value)}
          />
        </FormField>
        <FormField label="Frecuencia cardiaca (lpm)" htmlFor="vital-heart">
          <TextInput
            id="vital-heart"
            type="number"
            min="1"
            step="1"
            value={heartRateBpm}
            onChange={(event) => setHeartRateBpm(event.target.value)}
          />
        </FormField>
        <FormField label="Frecuencia respiratoria (rpm)" htmlFor="vital-respiratory">
          <TextInput
            id="vital-respiratory"
            type="number"
            min="1"
            step="1"
            value={respiratoryRateBpm}
            onChange={(event) => setRespiratoryRateBpm(event.target.value)}
          />
        </FormField>
      </div>
      <FormField label="Observaciones" htmlFor="vital-observations">
        <textarea
          id="vital-observations"
          className="input input--textarea"
          value={observations}
          maxLength={20000}
          onChange={(event) => setObservations(event.target.value)}
        />
      </FormField>
      <Button type="submit" disabled={saving}>
        {saving ? 'Guardando…' : 'Añadir medición'}
      </Button>
    </form>
  );
}

export function ClinicalEncounterDetailPage() {
  const { patientId, encounterId } = useParams<{ patientId: string; encounterId: string }>();
  const canReadEncounter = useCan(PERMISSION.CLINICAL_ENCOUNTERS_READ);
  const canReadVitals = useCan(PERMISSION.CLINICAL_VITALS_READ);
  const canReadEvolutions = useCan(PERMISSION.CLINICAL_EVOLUTIONS_READ);
  const canReadPrescriptions = useCan(PERMISSION.PRESCRIPTIONS_READ);
  const canReadVaccinations = useCan(PERMISSION.VACCINATIONS_READ);
  const canReadDewormings = useCan(PERMISSION.DEWORMINGS_READ);
  const canCreatePrescription = useCan(PERMISSION.PRESCRIPTIONS_CREATE);
  const canCreateVaccination = useCan(PERMISSION.VACCINATIONS_CREATE);
  const canCreateDeworming = useCan(PERMISSION.DEWORMINGS_CREATE);
  const canCreateProcedure = useCan(PERMISSION.PROCEDURES_CREATE);
  const canCreateAnesthesia = useCan(PERMISSION.ANESTHESIA_CREATE);
  const canReadHospitalizations = useCan(PERMISSION.HOSPITALIZATIONS_READ);
  const canCreateHospitalization = useCan(PERMISSION.HOSPITALIZATIONS_CREATE);
  const canReadAppointments = useCan(PERMISSION.APPOINTMENTS_READ);
  const canUpdateDraft = useCan(PERMISSION.CLINICAL_ENCOUNTERS_UPDATE_DRAFT);
  const canCreateVital = useCan(PERMISSION.CLINICAL_VITALS_CREATE);
  const canFinalize = useCan(PERMISSION.CLINICAL_ENCOUNTERS_FINALIZE);
  const canVoid = useCan(PERMISSION.CLINICAL_ENCOUNTERS_VOID);
  const canCreateEvolution = useCan(PERMISSION.CLINICAL_EVOLUTIONS_CREATE);
  const { activeMembership } = useAuth();
  const canReadPatients = useCan(PERMISSION.PATIENTS_READ);
  const organization = useClinicalOrganization();
  const encounter = useClinicalEncounter(encounterId, canReadEncounter);
  const patientState = usePatient(canReadPatients ? encounter.data?.patientId : undefined);
  const hospitalizations = useHospitalizationListResource(
    encounter.data?.patientId,
    1,
    canReadHospitalizations && Boolean(encounter.data),
    encounter.data?.id,
  );
  const vitals = useClinicalVitals(encounter.data?.id, canReadVitals && Boolean(encounter.data));
  const evolutions = useClinicalEvolutions(
    encounter.data?.patientId,
    1,
    canReadEvolutions && Boolean(encounter.data),
  );
  const profile = useProfessionalProfile(
    activeMembership?.clinicalRole === 'PRACTITIONER' && canReadEncounter,
  );
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);
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
  const isResponsiblePractitioner = activeMembership?.id === item.responsibleMembershipId;
  const responsibleDisplayName = item.responsibleProfessional?.displayName?.trim() || null;
  const responsibleProfileConfigured = Boolean(responsibleDisplayName);
  const currentResponsibleProfileMissing =
    item.status === 'DRAFT' &&
    canFinalize &&
    isResponsiblePractitioner &&
    (!profile.data || !profile.data.displayName.trim() || !responsibleProfileConfigured);
  const canOpenFinalizeReview =
    item.status === 'DRAFT' &&
    canFinalize &&
    isResponsiblePractitioner &&
    responsibleProfileConfigured &&
    Boolean(profile.data?.displayName.trim());
  const staleActionError =
    actionError instanceof ApiError && actionError.code === 'CLINICAL_ENCOUNTER_STALE';

  function reloadClinicalState() {
    encounter.reload();
    patientState.reload();
    vitals.reload();
    evolutions.reload();
  }

  function reloadAfterConflict() {
    setActionError(null);
    setFinalizeOpen(false);
    setVoidOpen(false);
    setVoidReason('');
    reloadClinicalState();
  }

  async function finalize() {
    setActionPending(true);
    setActionError(null);
    try {
      await clinicalApi.finalizeEncounter(item.id, { expectedVersion: item.version });
      setFinalizeOpen(false);
      reloadClinicalState();
    } catch (error: unknown) {
      if (
        error instanceof ApiError &&
        (error.code === 'CLINICAL_ENCOUNTER_IMMUTABLE' ||
          error.code === 'INVALID_CLINICAL_ENCOUNTER_STATE')
      ) {
        setFinalizeOpen(false);
        setActionError(
          new ApiError(
            'Esta consulta cambió desde que la abriste.',
            409,
            'CLINICAL_ENCOUNTER_STALE',
          ),
        );
        reloadClinicalState();
      } else {
        setActionError(error);
      }
    } finally {
      setActionPending(false);
    }
  }

  async function voidEncounter() {
    const reason = voidReason.trim();
    if (!reason) return;
    setActionPending(true);
    setActionError(null);
    try {
      await clinicalApi.voidEncounter(item.id, {
        expectedVersion: item.version,
        reason,
      });
      setVoidOpen(false);
      setVoidReason('');
      reloadClinicalState();
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === 'INVALID_CLINICAL_ENCOUNTER_STATE') {
        setVoidOpen(false);
        setActionError(
          new ApiError(
            'Esta consulta cambió desde que la abriste.',
            409,
            'CLINICAL_ENCOUNTER_STALE',
          ),
        );
        reloadClinicalState();
      } else {
        setActionError(error);
      }
    } finally {
      setActionPending(false);
    }
  }

  return (
    <div className="page-stack clinical-page">
      <PageHeader
        eyebrow="Encuentro clínico"
        title={item.reason}
        description={`${formatDateTime(item.occurredAt, timezone)} · ${item.patient.name}`}
        action={
          <span className="page-header__actions">
            {canCreateProcedure && item.status !== 'VOIDED' && item.patient.status === 'ACTIVE' ? (
              <Button
                as={Link}
                to={`/pacientes/${item.patientId}/historia/encuentros/${item.id}/procedimientos/nuevo`}
              >
                Nuevo procedimiento
              </Button>
            ) : null}
            {canCreateAnesthesia && item.status !== 'VOIDED' && item.patient.status === 'ACTIVE' ? (
              <Button
                as={Link}
                to={`/pacientes/${item.patientId}/historia/encuentros/${item.id}/anestesias/nueva`}
              >
                Nuevo registro anestésico
              </Button>
            ) : null}
            {canCreatePrescription && (item.status === 'DRAFT' || item.status === 'FINALIZED') ? (
              <Button
                as={Link}
                to={`/pacientes/${item.patientId}/historia/encuentros/${item.id}/prescripciones/nueva`}
              >
                Nueva prescripción
              </Button>
            ) : null}
            {canCreateVaccination &&
            (item.status === 'DRAFT' || item.status === 'FINALIZED') &&
            item.patient.status !== 'ARCHIVED' ? (
              <Button
                as={Link}
                to={`/pacientes/${item.patientId}/historia/encuentros/${item.id}/vacunas/nueva`}
              >
                Registrar vacunación
              </Button>
            ) : null}
            {canCreateDeworming &&
            (item.status === 'DRAFT' || item.status === 'FINALIZED') &&
            item.patient.status !== 'ARCHIVED' ? (
              <Button
                as={Link}
                to={`/pacientes/${item.patientId}/historia/encuentros/${item.id}/desparasitaciones/nueva`}
              >
                Registrar desparasitación
              </Button>
            ) : null}
            {item.status === 'DRAFT' && canUpdateDraft ? (
              <Button
                as={Link}
                to={`/pacientes/${item.patientId}/historia/encuentros/${item.id}/editar`}
              >
                Editar borrador
              </Button>
            ) : null}
            {canOpenFinalizeReview ? (
              <Button type="button" onClick={() => setFinalizeOpen(true)}>
                Finalizar consulta
              </Button>
            ) : null}
            {item.status === 'FINALIZED' && canVoid ? (
              <Button type="button" variant="danger" onClick={() => setVoidOpen(true)}>
                Anular consulta
              </Button>
            ) : null}
            <Button as={Link} to={`/pacientes/${item.patientId}/historia`} variant="secondary">
              Volver a historia
            </Button>
          </span>
        }
      />
      {currentResponsibleProfileMissing ? (
        <Alert tone="warning" role="status">
          Completa tu perfil profesional antes de finalizar esta consulta.{' '}
          <Link to="/perfil/profesional">Configurar perfil profesional</Link>
        </Alert>
      ) : null}
      {item.status === 'DRAFT' &&
      canFinalize &&
      !isResponsiblePractitioner &&
      item.responsibleMembershipId ? (
        <Alert tone="info" role="status">
          Esta consulta debe ser finalizada por{' '}
          {responsibleDisplayName ?? 'el Practitioner responsable'}.
        </Alert>
      ) : null}
      {actionError ? (
        <Alert tone="error" role="alert">
          {actionError instanceof ApiError && actionError.code === 'CLINICAL_ENCOUNTER_STALE'
            ? 'Esta consulta cambió desde que la abriste.'
            : errorMessage(actionError, 'No fue posible completar la operación clínica.')}
          {actionError instanceof ApiError &&
          (actionError.code === 'CLINICAL_ENCOUNTER_STALE' || actionError.status === 409) ? (
            <Button variant="secondary" type="button" onClick={reloadAfterConflict}>
              Recargar versión actual
            </Button>
          ) : null}
        </Alert>
      ) : null}
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
            {professionalDisplayName(item)}
            {item.professionalLicenseSnapshot ? ` · ${item.professionalLicenseSnapshot}` : ''}
          </p>
        ) : null}
      </Card>
      {canReadHospitalizations || canCreateHospitalization ? (
        <Card className="hospitalization-encounter-card">
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Ingreso intrahospitalario</p>
              <h2>Hospitalización del encuentro</h2>
            </div>
          </div>
          {hospitalizations.loading && canReadHospitalizations ? (
            <LoadingState label="Consultando episodio de hospitalización" />
          ) : hospitalizations.error && canReadHospitalizations ? (
            <ResourceError error={hospitalizations.error} onRetry={hospitalizations.reload} />
          ) : hospitalizations.data?.data[0] ? (
            <div className="hospitalization-encounter-card__content">
              <p>
                Episodio:{' '}
                <strong>
                  {hospitalizations.data.data[0].status === 'DRAFT'
                    ? 'Borrador'
                    : hospitalizations.data.data[0].status === 'ACTIVE'
                      ? 'Hospitalizado'
                      : hospitalizations.data.data[0].status === 'DISCHARGED'
                        ? 'Alta'
                        : 'Anulado'}
                </strong>
                {hospitalizations.data.data[0].locationName
                  ? ` · ${hospitalizations.data.data[0].locationName}`
                  : ''}
              </p>
              <Button
                as={Link}
                to={`/pacientes/${item.patientId}/historia/hospitalizaciones/${hospitalizations.data.data[0].id}`}
                variant="secondary"
              >
                Abrir episodio
              </Button>
            </div>
          ) : canCreateHospitalization &&
            item.status !== 'VOIDED' &&
            item.patient.status === 'ACTIVE' ? (
            <>
              <p className="clinical-muted">
                Este encuentro todavía no tiene episodio de hospitalización.
              </p>
              <Button
                as={Link}
                to={`/pacientes/${item.patientId}/historia/encuentros/${item.id}/hospitalizacion/nueva`}
              >
                Crear borrador de ingreso
              </Button>
            </>
          ) : (
            <p className="clinical-muted">Este encuentro no tiene un ingreso asociado.</p>
          )}
        </Card>
      ) : null}
      <DiagnosticEncounterSection
        patientId={item.patientId}
        encounterId={item.id}
        encounterStatus={item.status}
        patientStatus={item.patient.status}
      />
      <ConsentEncounterSection
        patientId={item.patientId}
        encounterId={item.id}
        encounterStatus={item.status}
        patientStatus={item.patient.status}
      />
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
      {canReadPrescriptions ? (
        <PrescriptionListSection
          patientId={item.patientId}
          encounterId={item.id}
          timezone={timezone}
          compact
        />
      ) : null}
      {canReadVaccinations ? (
        <VaccinationListSection
          patientId={item.patientId}
          timezone={timezone}
          clinicalEncounterId={item.id}
          compact
        />
      ) : null}
      {canReadDewormings ? (
        <DewormingListSection
          patientId={item.patientId}
          timezone={timezone}
          clinicalEncounterId={item.id}
          compact
        />
      ) : null}
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
          {item.status === 'VOIDED' ? (
            <Alert tone="warning" role="status">
              Estas mediciones pertenecen a una consulta anulada.
            </Alert>
          ) : null}
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
          {item.status === 'DRAFT' && canCreateVital ? (
            <>
              <div className="form-section">
                <div>
                  <p className="section-kicker">Nueva medición</p>
                  <h2>Añadir signos vitales</h2>
                </div>
                <p>Las mediciones se agregan al borrador y quedan como historial append-only.</p>
              </div>
              <DraftVitalForm encounterId={item.id} timezone={timezone} onSaved={vitals.reload} />
            </>
          ) : null}
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
            {item.status === 'FINALIZED' && canCreateEvolution ? (
              <Button
                as={Link}
                to={`/pacientes/${item.patientId}/historia/encuentros/${item.id}/evoluciones/nueva`}
              >
                Agregar evolución
              </Button>
            ) : null}
          </div>
          {evolutions.loading ? (
            <LoadingState label="Cargando evoluciones" />
          ) : relatedEvolutions.length ? (
            relatedEvolutions.map((evolution) => (
              <article className="clinical-note" key={evolution.id}>
                <strong>
                  {formatDateTime(evolution.occurredAt, timezone)} ·{' '}
                  {evolution.authorDisplayName ?? 'Profesional clínico'}
                </strong>
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
      <EncounterProcedureSections
        patientId={item.patientId}
        encounterId={item.id}
        encounterStatus={item.status}
        patientStatus={item.patient.status}
      />
      <Modal
        open={finalizeOpen}
        onClose={() => {
          if (!actionPending) setFinalizeOpen(false);
        }}
        eyebrow="Revisión clínica"
        title="Finalizar consulta"
        description="Revisa los datos antes de convertir este borrador en evidencia clínica definitiva."
      >
        {actionError instanceof ApiError && actionError.code === 'CLINICAL_ENCOUNTER_STALE' ? (
          <Alert tone="error" role="alert">
            Esta consulta cambió desde que la abriste. No se finalizará una versión que no hayas
            revisado.
            <Button variant="secondary" type="button" onClick={reloadAfterConflict}>
              Recargar versión actual
            </Button>
          </Alert>
        ) : null}
        <dl className="detail-list">
          <div>
            <dt>Paciente</dt>
            <dd>{item.patient.name}</dd>
          </div>
          <div>
            <dt>Fecha y hora</dt>
            <dd>{formatDateTime(item.occurredAt, timezone)}</dd>
          </div>
          <div>
            <dt>Sede</dt>
            <dd>{item.clinicLocation.name}</dd>
          </div>
          <div>
            <dt>Profesional responsable</dt>
            <dd>{responsibleDisplayName ?? 'Sin perfil profesional configurado'}</dd>
          </div>
          {item.responsibleProfessional?.licenseNumber ? (
            <div>
              <dt>Matrícula / registro</dt>
              <dd>{item.responsibleProfessional.licenseNumber}</dd>
            </div>
          ) : null}
          <div>
            <dt>Motivo</dt>
            <dd>{item.reason}</dd>
          </div>
          <div>
            <dt>Versión</dt>
            <dd>{item.version}</dd>
          </div>
        </dl>
        <Alert tone="warning" role="status">
          Al finalizar, esta consulta dejará de ser editable.
        </Alert>
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={actionPending}
            onClick={() => setFinalizeOpen(false)}
          >
            Revisar después
          </Button>
          <Button
            type="button"
            disabled={actionPending || staleActionError}
            onClick={() => void finalize()}
          >
            {actionPending ? 'Finalizando…' : 'Finalizar consulta'}
          </Button>
        </div>
      </Modal>
      <Modal
        open={voidOpen}
        onClose={() => {
          if (!actionPending) setVoidOpen(false);
        }}
        eyebrow="Operación excepcional"
        title="Anular consulta"
        description="La consulta seguirá conservada en la historia clínica y quedará marcada como anulada."
      >
        <form
          className="domain-form"
          onSubmit={(event) => {
            event.preventDefault();
            void voidEncounter();
          }}
        >
          <FormField
            label="Motivo de anulación *"
            htmlFor="void-reason"
            hint="Explica brevemente por qué esta evidencia deja de ser válida."
          >
            <textarea
              id="void-reason"
              className="input input--textarea"
              value={voidReason}
              maxLength={2_000}
              required
              onChange={(event) => {
                setVoidReason(event.target.value);
                setActionError(null);
              }}
            />
          </FormField>
          {actionError ? (
            <Alert tone="error" role="alert">
              {errorMessage(actionError, 'No fue posible anular la consulta.')}
              {actionError instanceof ApiError &&
              actionError.code === 'CLINICAL_ENCOUNTER_STALE' ? (
                <Button variant="secondary" type="button" onClick={reloadAfterConflict}>
                  Recargar versión actual
                </Button>
              ) : null}
            </Alert>
          ) : null}
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={actionPending}
              onClick={() => setVoidOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={actionPending || staleActionError || !voidReason.trim()}
            >
              {actionPending ? 'Anulando…' : 'Confirmar anulación'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
