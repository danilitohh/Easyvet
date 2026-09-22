import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { AnesthesiaObservation, AnesthesiaRecordDetail } from '@veterinary-saas/contracts';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { useAuth } from '../../contexts/useAuth';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { LoadingState } from '../../components/ui/LoadingState';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { TextInput } from '../../components/ui/TextInput';
import { ApiError } from '../../services/apiClient';
import { errorMessage } from '../shared/resourceUtils';
import { PaginationControls, ResourceError } from '../shared/ResourceFeedback';
import { useActiveOrganizationId } from '../shared/hooks';
import { useClinicalOrganization, useProfessionalProfile } from '../clinical/useClinical';
import { formatDateTime } from '../clinical/clinicalUtils';
import {
  useAnesthesiaObservationsResource,
  useAnesthesiaResource,
  useClinicalMutationGuard,
} from '../shared/useClinicalDomainResource';
import { anesthesiaApi } from './anesthesiaApi';
import {
  anesthesiaPatientName,
  anesthesiaProfessionalName,
  emptyObservationForm,
  observationFormFromItem,
  observationHasClinicalValue,
  observationPayload,
  type ObservationFormState,
} from './anesthesiaUtils';

const STATUS_LABEL = { DRAFT: 'Borrador', FINALIZED: 'Finalizado', VOIDED: 'Anulado' } as const;

function DetailValue({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="clinical-domain-field">
      <dt>{label}</dt>
      <dd>{value?.trim() || 'No registrado'}</dd>
    </div>
  );
}

function ObservationFields({
  form,
  onChange,
  disabled,
  prefix,
}: {
  form: ObservationFormState;
  onChange: (key: keyof ObservationFormState, value: string) => void;
  disabled: boolean;
  prefix: string;
}) {
  return (
    <div className="clinical-domain-form__grid observation-form-grid">
      <FormField label="Fecha y hora *" htmlFor={`${prefix}-date`}>
        <TextInput
          id={`${prefix}-date`}
          type="date"
          value={form.observedDate}
          disabled={disabled}
          onChange={(event) => onChange('observedDate', event.target.value)}
        />
      </FormField>
      <FormField label="Hora *" htmlFor={`${prefix}-time`}>
        <TextInput
          id={`${prefix}-time`}
          type="time"
          value={form.observedTime}
          disabled={disabled}
          onChange={(event) => onChange('observedTime', event.target.value)}
        />
      </FormField>
      <FormField label="HR (lpm)" htmlFor={`${prefix}-hr`}>
        <TextInput
          id={`${prefix}-hr`}
          type="number"
          min="0"
          step="1"
          value={form.heartRateBpm}
          disabled={disabled}
          onChange={(event) => onChange('heartRateBpm', event.target.value)}
        />
      </FormField>
      <FormField label="RR (rpm)" htmlFor={`${prefix}-rr`}>
        <TextInput
          id={`${prefix}-rr`}
          type="number"
          min="0"
          step="1"
          value={form.respiratoryRatePerMinute}
          disabled={disabled}
          onChange={(event) => onChange('respiratoryRatePerMinute', event.target.value)}
        />
      </FormField>
      <FormField label="Temperatura (°C)" htmlFor={`${prefix}-temp`}>
        <TextInput
          id={`${prefix}-temp`}
          type="number"
          min="0.001"
          step="0.1"
          value={form.temperatureC}
          disabled={disabled}
          onChange={(event) => onChange('temperatureC', event.target.value)}
        />
      </FormField>
      <FormField label="Presión arterial" htmlFor={`${prefix}-bp`}>
        <TextInput
          id={`${prefix}-bp`}
          value={form.bloodPressureText}
          maxLength={200}
          disabled={disabled}
          onChange={(event) => onChange('bloodPressureText', event.target.value)}
        />
      </FormField>
      <FormField label="SpO₂ (%)" htmlFor={`${prefix}-spo2`}>
        <TextInput
          id={`${prefix}-spo2`}
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={form.spo2Percent}
          disabled={disabled}
          onChange={(event) => onChange('spo2Percent', event.target.value)}
        />
      </FormField>
      <FormField label="EtCO₂ (mmHg)" htmlFor={`${prefix}-etco2`}>
        <TextInput
          id={`${prefix}-etco2`}
          type="number"
          min="0"
          step="0.1"
          value={form.etco2MmHg}
          disabled={disabled}
          onChange={(event) => onChange('etco2MmHg', event.target.value)}
        />
      </FormField>
      <FormField label="Plano anestésico" htmlFor={`${prefix}-plane`}>
        <TextInput
          id={`${prefix}-plane`}
          value={form.anestheticPlane}
          maxLength={500}
          disabled={disabled}
          onChange={(event) => onChange('anestheticPlane', event.target.value)}
        />
      </FormField>
      <FormField label="Notas" htmlFor={`${prefix}-notes`}>
        <textarea
          id={`${prefix}-notes`}
          className="input input--textarea"
          value={form.notes}
          maxLength={5000}
          disabled={disabled}
          onChange={(event) => onChange('notes', event.target.value)}
        />
      </FormField>
    </div>
  );
}

function ObservationCard({
  item,
  timezone,
  editable,
  editing,
  onEdit,
  onDelete,
}: {
  item: AnesthesiaObservation;
  timezone: string;
  editable: boolean;
  editing: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="anesthesia-observation-card">
      <div className="anesthesia-observation-card__heading">
        <h3>{formatDateTime(item.observedAt, timezone)}</h3>
        {editable ? (
          <div className="page-header__actions">
            <Button variant="secondary" type="button" onClick={onEdit}>
              {editing ? 'Cerrar edición' : 'Editar lectura'}
            </Button>
            <Button variant="danger" type="button" onClick={onDelete}>
              Eliminar lectura
            </Button>
          </div>
        ) : null}
      </div>
      {editing ? null : (
        <dl className="anesthesia-observation-values">
          <DetailValue
            label="HR"
            value={item.heartRateBpm === null ? 'No registrado' : `${item.heartRateBpm} lpm`}
          />
          <DetailValue
            label="RR"
            value={
              item.respiratoryRatePerMinute === null
                ? 'No registrado'
                : `${item.respiratoryRatePerMinute} rpm`
            }
          />
          <DetailValue
            label="Temp"
            value={item.temperatureC === null ? 'No registrado' : `${item.temperatureC} °C`}
          />
          <DetailValue label="BP" value={item.bloodPressureText} />
          <DetailValue
            label="SpO₂"
            value={item.spo2Percent === null ? 'No registrado' : `${item.spo2Percent}%`}
          />
          <DetailValue
            label="EtCO₂"
            value={item.etco2MmHg === null ? 'No registrado' : `${item.etco2MmHg} mmHg`}
          />
          <DetailValue label="Plano" value={item.anestheticPlane} />
          <DetailValue label="Notas" value={item.notes} />
        </dl>
      )}
    </article>
  );
}

// Detail operations use the latest parent version for every observation write and never auto-retry stale requests.
export function AnesthesiaDetailPage() {
  const { patientId, anesthesiaRecordId } = useParams<{
    patientId: string;
    anesthesiaRecordId: string;
  }>();
  const canRead = useCan(PERMISSION.ANESTHESIA_READ);
  const canUpdateDraft = useCan(PERMISSION.ANESTHESIA_UPDATE_DRAFT);
  const canFinalize = useCan(PERMISSION.ANESTHESIA_FINALIZE);
  const canVoid = useCan(PERMISSION.ANESTHESIA_VOID);
  const canReadEncounter = useCan(PERMISSION.CLINICAL_ENCOUNTERS_READ);
  const canReadProcedures = useCan(PERMISSION.PROCEDURES_READ);
  const { activeMembership } = useAuth();
  const organization = useClinicalOrganization();
  const record = useAnesthesiaResource(anesthesiaRecordId, canRead);
  const [observationPage, setObservationPage] = useState(1);
  const observations = useAnesthesiaObservationsResource(
    anesthesiaRecordId,
    observationPage,
    canRead && Boolean(record.data),
  );
  const mutationGuard = useClinicalMutationGuard();
  const organizationId = useActiveOrganizationId();
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [editingObservationId, setEditingObservationId] = useState<string | null>(null);
  const [observationForm, setObservationForm] = useState<ObservationFormState>(() =>
    emptyObservationForm(),
  );
  const [observationError, setObservationError] = useState<unknown>(null);
  const [recordVersion, setRecordVersion] = useState(1);
  const recordVersionRef = useRef(1);
  const item: AnesthesiaRecordDetail | null = record.data;
  const timezone = organization.data?.timezone ?? 'UTC';
  const isResponsible = Boolean(
    item && activeMembership?.id === item.responsiblePractitionerMembershipId,
  );
  const profile = useProfessionalProfile(
    Boolean(
      item && canFinalize && isResponsible && activeMembership?.clinicalRole === 'PRACTITIONER',
    ),
  );
  const profileConfigured = Boolean(profile.data?.displayName.trim());
  const parentVoided = item?.parentEncounterStatus === 'VOIDED';
  const procedureVoided = item?.linkedProcedureStatus === 'VOIDED';
  const patientArchived = item?.patient.status === 'ARCHIVED';
  const canFinalizeThis = Boolean(
    item &&
    item.status === 'DRAFT' &&
    canFinalize &&
    isResponsible &&
    !parentVoided &&
    !procedureVoided &&
    !patientArchived &&
    profileConfigured &&
    !profile.error &&
    item.startedAt,
  );
  const canMutateObservations = Boolean(
    item &&
    item.status === 'DRAFT' &&
    canUpdateDraft &&
    !parentVoided &&
    !procedureVoided &&
    !patientArchived,
  );

  useEffect(() => {
    if (item?.id) {
      recordVersionRef.current = item.version;
      setRecordVersion(item.version);
    }
  }, [item?.id, item?.version]);

  // A switched organization clears modal state, monitoring forms and the displayed aggregate version.
  useEffect(() => {
    setPending(false);
    setActionError(null);
    setObservationError(null);
    setFinalizeOpen(false);
    setVoidOpen(false);
    setVoidReason('');
    setEditingObservationId(null);
    setObservationForm(emptyObservationForm());
    recordVersionRef.current = 1;
    setRecordVersion(1);
    setObservationPage(1);
  }, [organizationId]);

  async function runAction(action: 'finalize' | 'void') {
    if (!item || pending) return;
    setPending(true);
    setActionError(null);
    try {
      if (action === 'finalize')
        await anesthesiaApi.finalize(item.id, item.version, mutationGuard.signal());
      else
        await anesthesiaApi.void(
          item.id,
          { expectedVersion: item.version, reason: voidReason.trim() },
          mutationGuard.signal(),
        );
      if (mutationGuard.isCurrent()) {
        setFinalizeOpen(false);
        setVoidOpen(false);
        setVoidReason('');
        record.reload();
        observations.reload();
      }
    } catch (error) {
      if (mutationGuard.isCurrent()) setActionError(error);
    } finally {
      if (mutationGuard.isCurrent()) setPending(false);
    }
  }

  function changeObservation<K extends keyof ObservationFormState>(
    key: K,
    value: ObservationFormState[K],
  ) {
    setObservationForm((current) => ({ ...current, [key]: value }));
    setObservationError(null);
  }

  function startObservationEdit(itemToEdit: AnesthesiaObservation) {
    if (editingObservationId === itemToEdit.id) {
      setEditingObservationId(null);
      return;
    }
    setObservationForm(observationFormFromItem(itemToEdit, timezone));
    setEditingObservationId(itemToEdit.id);
    setObservationError(null);
  }

  async function saveObservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item || !canMutateObservations || pending) return;
    let payload;
    try {
      payload = observationPayload(observationForm, timezone);
    } catch {
      setObservationError(
        new Error('La fecha y hora de la lectura no son válidas para esta zona horaria.'),
      );
      return;
    }
    if (!observationHasClinicalValue(payload)) {
      setObservationError(
        new Error('Añade al menos un valor clínico, plano anestésico o nota además de la hora.'),
      );
      return;
    }
    const original = editingObservationId
      ? observations.data?.data.find((entry) => entry.id === editingObservationId)
      : null;
    if (
      original &&
      JSON.stringify(observationPayload(observationFormFromItem(original, timezone), timezone)) ===
        JSON.stringify(payload)
    ) {
      setObservationError(new Error('No hay cambios nuevos para guardar.'));
      return;
    }
    setPending(true);
    setObservationError(null);
    try {
      const result = editingObservationId
        ? await anesthesiaApi.updateObservation(
            item.id,
            editingObservationId,
            { ...payload, expectedVersion: recordVersionRef.current },
            mutationGuard.signal(),
          )
        : await anesthesiaApi.createObservation(
            item.id,
            { ...payload, expectedVersion: recordVersionRef.current },
            mutationGuard.signal(),
          );
      if (mutationGuard.isCurrent()) {
        recordVersionRef.current = result.anesthesiaRecordVersion;
        setRecordVersion(result.anesthesiaRecordVersion);
        setEditingObservationId(null);
        setObservationForm(emptyObservationForm(new Date().toISOString(), timezone));
        observations.reload();
        record.reload();
      }
    } catch (error) {
      if (mutationGuard.isCurrent()) setObservationError(error);
    } finally {
      if (mutationGuard.isCurrent()) setPending(false);
    }
  }

  async function deleteObservation(observationId: string) {
    if (
      !item ||
      !canMutateObservations ||
      pending ||
      !window.confirm('¿Eliminar esta lectura del borrador?')
    )
      return;
    setPending(true);
    setObservationError(null);
    try {
      const result = await anesthesiaApi.removeObservation(
        item.id,
        observationId,
        { expectedVersion: recordVersionRef.current },
        mutationGuard.signal(),
      );
      if (mutationGuard.isCurrent()) {
        recordVersionRef.current = result.anesthesiaRecordVersion;
        setRecordVersion(result.anesthesiaRecordVersion);
        if (editingObservationId === observationId) setEditingObservationId(null);
        observations.reload();
        record.reload();
      }
    } catch (error) {
      if (mutationGuard.isCurrent()) setObservationError(error);
    } finally {
      if (mutationGuard.isCurrent()) setPending(false);
    }
  }

  if (!patientId || !anesthesiaRecordId)
    return (
      <ResourceError error={new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')} />
    );
  if (!canRead)
    return (
      <ResourceError
        error={new ApiError('No tienes permiso para consultar este registro anestésico.', 403)}
      />
    );
  if (organization.loading || record.loading || profile.loading)
    return <LoadingState label="Cargando registro anestésico" />;
  if (organization.error)
    return <ResourceError error={organization.error} onRetry={organization.reload} />;
  if (record.error || !item || item.patientId !== patientId)
    return (
      <ResourceError
        error={record.error ?? new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')}
        onRetry={record.reload}
      />
    );
  if (observations.error)
    return <ResourceError error={observations.error} onRetry={observations.reload} />;

  const values = [
    item.asaClassification,
    item.technique,
    item.preAnestheticAssessment,
    item.medicationsText,
    item.airwayManagement,
    item.fluidsText,
    item.complications,
    item.recoveryNotes,
    item.notes,
  ];
  const fieldLabels = [
    'Clasificación ASA',
    'Técnica anestésica',
    'Evaluación preanestésica',
    'Medicamentos (texto libre)',
    'Manejo de vía aérea',
    'Fluidos',
    'Complicaciones',
    'Recuperación',
    'Notas',
  ];
  const historicalOwner =
    item.status === 'DRAFT'
      ? 'No registrado'
      : item.ownerDisplayNameSnapshot?.trim() || 'Snapshot de propietario no disponible';
  const stale =
    (actionError instanceof ApiError && actionError.code === 'ANESTHESIA_STALE') ||
    (observationError instanceof ApiError && observationError.code === 'ANESTHESIA_STALE');
  const showStale = stale ? (
    <>
      El registro anestésico cambió en otra sesión. No se repitió la acción; tus datos locales se
      conservaron.{' '}
      <button
        className="link-button"
        type="button"
        onClick={() => {
          record.reload();
          observations.reload();
        }}
      >
        Recargar versión actual
      </button>{' '}
      cuando decidas descartar los cambios pendientes.
    </>
  ) : null;

  return (
    <div className="page-stack clinical-page clinical-domain-page">
      <PageHeader
        eyebrow="Anestesia"
        title="Registro anestésico"
        description={`${anesthesiaPatientName(item)} · ${formatDateTime(item.startedAt, timezone)}`}
        action={
          <span className="page-header__actions">
            {item.status === 'DRAFT' && canUpdateDraft && !parentVoided && !patientArchived ? (
              <Button
                as={Link}
                to={`/pacientes/${patientId}/historia/anestesias/${item.id}/editar`}
              >
                Editar borrador
              </Button>
            ) : null}
            {canFinalizeThis ? (
              <Button onClick={() => setFinalizeOpen(true)}>Finalizar</Button>
            ) : null}
            {item.status === 'FINALIZED' && canVoid ? (
              <Button variant="danger" onClick={() => setVoidOpen(true)}>
                Anular registro
              </Button>
            ) : null}
            <Button
              as={Link}
              to={`/pacientes/${patientId}/historia/procedimientos`}
              variant="secondary"
            >
              Volver al listado
            </Button>
          </span>
        }
      />
      {item.status === 'DRAFT' && patientArchived ? (
        <Alert tone="warning" role="status">
          El paciente está archivado. Este borrador se conserva para lectura histórica.
        </Alert>
      ) : null}
      {item.status === 'DRAFT' && canFinalize && !isResponsible ? (
        <Alert tone="info" role="status">
          Solo el profesional responsable asignado
          {item.responsiblePractitioner?.displayName
            ? ` (${item.responsiblePractitioner.displayName})`
            : ''}{' '}
          puede finalizar este registro.
        </Alert>
      ) : null}
      {item.status === 'DRAFT' && canFinalize && isResponsible && profile.error ? (
        <Alert tone="warning" role="status">
          No se pudo verificar tu perfil profesional.{' '}
          <button className="link-button" type="button" onClick={profile.reload}>
            Reintentar verificación
          </button>
        </Alert>
      ) : null}
      {item.status === 'DRAFT' &&
      canFinalize &&
      isResponsible &&
      !profile.error &&
      !profileConfigured ? (
        <Alert tone="warning" role="status">
          Completa tu perfil profesional antes de finalizar.{' '}
          <Link to="/perfil/profesional">Configurar perfil profesional</Link>
        </Alert>
      ) : null}
      {item.status === 'DRAFT' && canFinalize && !item.startedAt ? (
        <Alert tone="info" role="status">
          Para finalizar, registra la fecha y hora de inicio.
        </Alert>
      ) : null}
      {actionError ? (
        <Alert tone="error" role="alert">
          {showStale ?? errorMessage(actionError, 'No se pudo completar la acción.')}
        </Alert>
      ) : null}
      <Card className="clinical-domain-status">
        <div className="detail-card__heading">
          <div>
            <p className="section-kicker">Estado del registro</p>
            <h2>{STATUS_LABEL[item.status]}</h2>
          </div>
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
        </div>
        {item.finalizedAt ? (
          <p className="clinical-meta">
            Finalizado {formatDateTime(item.finalizedAt, timezone)} ·{' '}
            {item.status === 'DRAFT'
              ? 'Profesional clínico'
              : item.professionalDisplayNameSnapshot || 'Snapshot profesional no disponible'}
            {item.professionalLicenseSnapshot ? ` · ${item.professionalLicenseSnapshot}` : ''}
          </p>
        ) : null}
        {item.status === 'VOIDED' ? (
          <>
            <p className="clinical-meta">Anulado {formatDateTime(item.voidedAt, timezone)}</p>
            <DetailValue label="Motivo de anulación" value={item.voidReason} />
          </>
        ) : null}
        {item.parentEncounterStatus === 'VOIDED' ? (
          <Alert tone="warning" role="status">
            La consulta clínica asociada fue anulada.
            {item.status === 'DRAFT'
              ? ' Este borrador no se puede modificar ni finalizar.'
              : ' El estado del registro anestésico se mantiene por separado.'}
          </Alert>
        ) : null}
        {procedureVoided ? (
          <Alert tone="warning" role="status">
            El procedimiento clínico asociado fue anulado.
            {item.status === 'DRAFT'
              ? ' Cambia o elimina el vínculo para continuar el borrador; no se puede finalizar mientras siga asociado.'
              : ' El estado del registro anestésico se mantiene por separado.'}
          </Alert>
        ) : null}
      </Card>
      <Card>
        <div className="detail-card__heading">
          <div>
            <p className="section-kicker">Datos clínicos</p>
            <h2>Registro de anestesia</h2>
          </div>
        </div>
        <dl className="clinical-domain-fields">
          <DetailValue label="Paciente" value={anesthesiaPatientName(item)} />
          <DetailValue label="Propietario histórico" value={historicalOwner} />
          <DetailValue
            label="Profesional responsable"
            value={`${anesthesiaProfessionalName(item)}${item.status !== 'DRAFT' && item.professionalLicenseSnapshot ? ` · ${item.professionalLicenseSnapshot}` : ''}`}
          />
          <DetailValue label="Inicio" value={formatDateTime(item.startedAt, timezone)} />
          <DetailValue label="Fin" value={formatDateTime(item.endedAt, timezone)} />
          <DetailValue label="Consulta relacionada" value={item.clinicalEncounterId} />
          <DetailValue
            label="Estado de la consulta"
            value={
              item.parentEncounterStatus === 'VOIDED'
                ? 'Anulada'
                : item.parentEncounterStatus === 'FINALIZED'
                  ? 'Finalizada'
                  : 'Borrador'
            }
          />
          <DetailValue
            label="Procedimiento asociado"
            value={
              item.linkedProcedure
                ? `${item.linkedProcedure.procedureName || (item.linkedProcedure.kind === 'SURGERY' ? 'Cirugía' : 'Procedimiento')} · ${item.linkedProcedure.status === 'VOIDED' ? 'Anulado' : item.linkedProcedure.status === 'FINALIZED' ? 'Finalizado' : 'Borrador'}`
                : 'Sin procedimiento asociado'
            }
          />
          <DetailValue label="Versión" value={String(recordVersion)} />
        </dl>
        <dl className="clinical-domain-fields">
          {values.map((value, index) => (
            <DetailValue
              key={fieldLabels[index] ?? index}
              label={fieldLabels[index] ?? 'Dato clínico'}
              value={value ?? null}
            />
          ))}
        </dl>
        {canReadEncounter ? (
          <Link to={`/pacientes/${patientId}/historia/encuentros/${item.clinicalEncounterId}`}>
            Abrir consulta relacionada
          </Link>
        ) : null}
        {item.linkedProcedure && canReadProcedures ? (
          <Link to={`/pacientes/${patientId}/historia/procedimientos/${item.linkedProcedure.id}`}>
            Abrir procedimiento relacionado
          </Link>
        ) : null}
      </Card>
      <Card className="anesthesia-monitoring">
        <div className="detail-card__heading">
          <div>
            <p className="section-kicker">Monitorización</p>
            <h2>Lecturas anestésicas</h2>
          </div>
          <Badge>{`${observations.data?.pagination.total ?? item.observationCount} lecturas`}</Badge>
        </div>
        {observationError ? (
          <Alert tone="error" role="alert">
            {showStale ?? errorMessage(observationError, 'No se pudo actualizar la lectura.')}
          </Alert>
        ) : null}
        {canMutateObservations && !editingObservationId ? (
          <form
            className="anesthesia-observation-editor"
            onSubmit={(event) => void saveObservation(event)}
          >
            <h3>Añadir lectura al borrador</h3>
            <ObservationFields
              form={observationForm}
              onChange={(key, value) => changeObservation(key, value)}
              disabled={pending}
              prefix="observation"
            />
            <div className="modal-actions">
              <Button type="submit" disabled={pending}>
                {pending ? 'Guardando…' : 'Añadir lectura'}
              </Button>
            </div>
          </form>
        ) : null}
        {observations.loading ? (
          <LoadingState label="Cargando lecturas" />
        ) : observations.data?.data.length ? (
          <div className="anesthesia-observation-list">
            {observations.data.data.map((entry) => (
              <div key={entry.id}>
                <ObservationCard
                  item={entry}
                  timezone={timezone}
                  editable={canMutateObservations}
                  editing={editingObservationId === entry.id}
                  onEdit={() => startObservationEdit(entry)}
                  onDelete={() => void deleteObservation(entry.id)}
                />
                {editingObservationId === entry.id ? (
                  <form
                    className="anesthesia-observation-editor anesthesia-observation-editor--inline"
                    onSubmit={(event) => void saveObservation(event)}
                  >
                    <ObservationFields
                      form={observationForm}
                      onChange={(key, value) => changeObservation(key, value)}
                      disabled={pending}
                      prefix="observation-edit"
                    />
                    <div className="modal-actions">
                      <Button type="submit" disabled={pending}>
                        {pending ? 'Guardando…' : 'Guardar lectura'}
                      </Button>
                      <Button
                        variant="secondary"
                        type="button"
                        disabled={pending}
                        onClick={() => setEditingObservationId(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="clinical-muted">No hay lecturas de monitorización registradas.</p>
        )}
        <PaginationControls
          page={observations.data?.pagination.page ?? observationPage}
          totalPages={observations.data?.pagination.totalPages ?? 0}
          onChange={setObservationPage}
        />
        {!canMutateObservations && item.status !== 'DRAFT' ? (
          <p className="clinical-muted">
            Las lecturas de un registro finalizado o anulado son de solo lectura.
          </p>
        ) : null}
      </Card>
      <Modal
        open={finalizeOpen}
        onClose={() => {
          if (!pending) setFinalizeOpen(false);
        }}
        eyebrow="Revisión anestésica"
        title="Finalizar registro anestésico"
        description="Después de finalizar, el registro y sus lecturas quedarán en modo de solo lectura."
      >
        <dl className="clinical-domain-fields">
          <DetailValue label="Paciente" value={anesthesiaPatientName(item)} />
          <DetailValue label="Inicio" value={formatDateTime(item.startedAt, timezone)} />
          <DetailValue
            label="Fin"
            value={item.endedAt ? formatDateTime(item.endedAt, timezone) : 'No registrado'}
          />
          <DetailValue label="Responsable" value={anesthesiaProfessionalName(item)} />
          <DetailValue
            label="Procedimiento"
            value={item.linkedProcedure?.procedureName || 'Sin procedimiento asociado'}
          />
          <DetailValue label="Lecturas" value={String(item.observationCount)} />
          <DetailValue label="Versión revisada" value={String(item.version)} />
        </dl>
        <Alert tone="warning" role="status">
          Al finalizar, este registro anestésico dejará de ser editable.
        </Alert>
        <div className="modal-actions">
          <Button variant="secondary" disabled={pending} onClick={() => setFinalizeOpen(false)}>
            Revisar después
          </Button>
          <Button disabled={pending} onClick={() => void runAction('finalize')}>
            {pending ? 'Finalizando…' : 'Confirmar finalización'}
          </Button>
        </div>
      </Modal>
      <Modal
        open={voidOpen}
        onClose={() => {
          if (!pending) setVoidOpen(false);
        }}
        eyebrow="Corrección histórica"
        title="Anular registro anestésico"
        description="El registro y todas sus lecturas se conservarán en la historia clínica."
      >
        <FormField label="Motivo de anulación *" htmlFor="anesthesia-void-reason">
          <textarea
            id="anesthesia-void-reason"
            className="input input--textarea"
            value={voidReason}
            maxLength={1000}
            disabled={pending}
            onChange={(event) => setVoidReason(event.target.value)}
          />
        </FormField>
        <div className="modal-actions">
          <Button variant="secondary" disabled={pending} onClick={() => setVoidOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={pending || !voidReason.trim()}
            onClick={() => void runAction('void')}
          >
            {pending ? 'Anulando…' : 'Confirmar anulación'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
