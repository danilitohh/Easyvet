import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { useAuth } from '../../contexts/useAuth';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormField } from '../../components/ui/FormField';
import { LoadingState } from '../../components/ui/LoadingState';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { TextInput } from '../../components/ui/TextInput';
import { ApiError } from '../../services/apiClient';
import { instantFromCivil } from '../agenda/agendaUtils';
import { useClinicalOrganization } from '../clinical/useClinical';
import { formatDateTime } from '../clinical/clinicalUtils';
import { PaginationControls, ResourceError } from '../shared/ResourceFeedback';
import { errorMessage } from '../shared/resourceUtils';
import {
  useClinicalMutationGuard,
  useHospitalizationEntriesResource,
  useHospitalizationResource,
} from '../shared/useClinicalDomainResource';
import { hospitalizationsApi } from './hospitalizationsApi';
import { currentLocalDateTime, defaultDischargeDateTime } from './hospitalizationDateUtils';

const STATUS_LABEL = {
  DRAFT: 'Borrador',
  ACTIVE: 'Hospitalizado',
  DISCHARGED: 'Alta',
  VOIDED: 'Anulado',
} as const;
const ENTRY_LABEL = {
  EVOLUTION: 'Evolución',
  MONITORING: 'Monitoreo',
  MEDICATION: 'Medicamentos',
  NURSING: 'Enfermería',
  DIET: 'Dieta',
  OTHER: 'Otro registro',
} as const;

function asInstant(value: string, timezone: string): string {
  const [date, time] = value.split('T');
  return instantFromCivil(date ?? '', time ?? '', timezone);
}

// Shows one immutable Kardex page as cards so long notes remain usable on narrow screens.
function HospitalizationKardex({
  hospitalizationId,
  status,
  timezone,
  canCreateEntry,
  version,
  onChanged,
}: {
  hospitalizationId: string;
  status: 'DRAFT' | 'ACTIVE' | 'DISCHARGED' | 'VOIDED';
  timezone: string;
  canCreateEntry: boolean;
  version: number;
  onChanged: () => void;
}) {
  const [page, setPage] = useState(1);
  const [entryType, setEntryType] = useState<keyof typeof ENTRY_LABEL>('EVOLUTION');
  const [recordedAt, setRecordedAt] = useState(() =>
    currentLocalDateTime(new Date().toISOString(), timezone),
  );
  const [content, setContent] = useState('');
  const [temperature, setTemperature] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [respiratoryRate, setRespiratoryRate] = useState('');
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const entries = useHospitalizationEntriesResource(hospitalizationId, page, status !== 'DRAFT');
  const guard = useClinicalMutationGuard();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await hospitalizationsApi.addEntry(
        hospitalizationId,
        {
          expectedVersion: version,
          entryType,
          recordedAt: asInstant(recordedAt, timezone),
          content: content.trim() || null,
          temperatureC: temperature === '' ? null : Number(temperature),
          heartRateBpm: heartRate === '' ? null : Number(heartRate),
          respiratoryRatePerMinute: respiratoryRate === '' ? null : Number(respiratoryRate),
          weightKg: weight === '' ? null : Number(weight),
        },
        guard.signal(),
      );
      if (!guard.isCurrent()) return;
      setContent('');
      setTemperature('');
      setHeartRate('');
      setRespiratoryRate('');
      setWeight('');
      setPage(1);
      onChanged();
      entries.reload();
    } catch (requestError) {
      if (guard.isCurrent()) setError(requestError);
    } finally {
      if (guard.isCurrent()) setSaving(false);
    }
  }

  return (
    <Card className="hospitalization-kardex">
      <div className="detail-card__heading">
        <div>
          <p className="section-kicker">Registro cronológico</p>
          <h2>Kardex</h2>
        </div>
        <Badge>{`${entries.data?.pagination.total ?? 0} registros`}</Badge>
      </div>
      <p className="clinical-muted">
        Los registros se conservan cronológicamente. No se pueden editar ni eliminar.
      </p>
      {canCreateEntry && status === 'ACTIVE' ? (
        <form className="hospitalization-entry-form" onSubmit={(event) => void submit(event)}>
          {error ? (
            <Alert tone="error" role="alert">
              {error instanceof ApiError && error.status === 409
                ? 'Otra operación actualizó el episodio. Recarga y vuelve a intentarlo con la versión actual.'
                : errorMessage(error, 'No fue posible guardar el registro.')}
              {error instanceof ApiError && error.status === 409 ? (
                <Button type="button" variant="secondary" onClick={onChanged}>
                  Recargar episodio
                </Button>
              ) : null}
            </Alert>
          ) : null}
          <div className="form-grid form-grid--three">
            <FormField label="Tipo de registro" htmlFor="hospitalization-entry-type">
              <select
                id="hospitalization-entry-type"
                className="input"
                value={entryType}
                onChange={(event) => setEntryType(event.target.value as keyof typeof ENTRY_LABEL)}
                disabled={saving}
              >
                {Object.entries(ENTRY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label="Fecha y hora"
              htmlFor="hospitalization-entry-recorded-at"
              hint={`Zona horaria: ${timezone}`}
            >
              <TextInput
                id="hospitalization-entry-recorded-at"
                type="datetime-local"
                value={recordedAt}
                onChange={(event) => setRecordedAt(event.target.value)}
                required
                disabled={saving}
              />
            </FormField>
            <FormField label="Temperatura (°C)" htmlFor="hospitalization-entry-temperature">
              <TextInput
                id="hospitalization-entry-temperature"
                type="number"
                min="0.001"
                step="any"
                value={temperature}
                onChange={(event) => setTemperature(event.target.value)}
                disabled={saving}
              />
            </FormField>
            <FormField label="Frecuencia cardiaca (lpm)" htmlFor="hospitalization-entry-heart-rate">
              <TextInput
                id="hospitalization-entry-heart-rate"
                type="number"
                min="0"
                step="1"
                value={heartRate}
                onChange={(event) => setHeartRate(event.target.value)}
                disabled={saving}
              />
            </FormField>
            <FormField
              label="Frecuencia respiratoria (rpm)"
              htmlFor="hospitalization-entry-respiratory-rate"
            >
              <TextInput
                id="hospitalization-entry-respiratory-rate"
                type="number"
                min="0"
                step="1"
                value={respiratoryRate}
                onChange={(event) => setRespiratoryRate(event.target.value)}
                disabled={saving}
              />
            </FormField>
            <FormField label="Peso (kg)" htmlFor="hospitalization-entry-weight">
              <TextInput
                id="hospitalization-entry-weight"
                type="number"
                min="0.001"
                step="any"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                disabled={saving}
              />
            </FormField>
            <FormField label="Nota clínica" htmlFor="hospitalization-entry-content">
              <textarea
                id="hospitalization-entry-content"
                className="input textarea"
                maxLength={10000}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                disabled={saving}
              />
            </FormField>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Agregar al Kardex'}
          </Button>
        </form>
      ) : null}
      {entries.loading ? (
        <LoadingState label="Cargando Kardex" />
      ) : entries.error ? (
        <ResourceError error={entries.error} onRetry={entries.reload} />
      ) : entries.data?.data.length ? (
        <div className="hospitalization-kardex__entries">
          {entries.data.data.map((entry) => (
            <article className="hospitalization-entry" key={entry.id}>
              <div className="hospitalization-entry__heading">
                <strong>{ENTRY_LABEL[entry.entryType]}</strong>
                <time dateTime={entry.recordedAt}>
                  {formatDateTime(entry.recordedAt, timezone)}
                </time>
              </div>
              {entry.content ? <p className="clinical-prose">{entry.content}</p> : null}
              <dl className="hospitalization-vitals">
                {entry.temperatureC !== null ? (
                  <div>
                    <dt>Temperatura</dt>
                    <dd>{entry.temperatureC} °C</dd>
                  </div>
                ) : null}
                {entry.heartRateBpm !== null ? (
                  <div>
                    <dt>FC</dt>
                    <dd>{entry.heartRateBpm} lpm</dd>
                  </div>
                ) : null}
                {entry.respiratoryRatePerMinute !== null ? (
                  <div>
                    <dt>FR</dt>
                    <dd>{entry.respiratoryRatePerMinute} rpm</dd>
                  </div>
                ) : null}
                {entry.weightKg !== null ? (
                  <div>
                    <dt>Peso</dt>
                    <dd>{entry.weightKg} kg</dd>
                  </div>
                ) : null}
              </dl>
              <small>Registrado por {entry.recordedByDisplayName ?? 'Personal clínico'}</small>
            </article>
          ))}
          <PaginationControls
            page={entries.data.pagination.page}
            totalPages={entries.data.pagination.totalPages}
            onChange={setPage}
          />
        </div>
      ) : (
        <EmptyState
          title="Sin registros todavía"
          description={
            status === 'ACTIVE'
              ? 'Agrega evoluciones, monitoreos o notas de cuidado a este episodio.'
              : 'Este episodio no contiene registros de Kardex.'
          }
        />
      )}
    </Card>
  );
}

// Aggregates lifecycle actions, historical snapshots, and read-only access to discharged episodes.
export function HospitalizationDetailPage() {
  const { patientId = '', hospitalizationId = '' } = useParams<{
    patientId: string;
    hospitalizationId: string;
  }>();
  const navigate = useNavigate();
  const canUpdate = useCan(PERMISSION.HOSPITALIZATIONS_UPDATE);
  const canActivate = useCan(PERMISSION.HOSPITALIZATIONS_ACTIVATE);
  const canDischarge = useCan(PERMISSION.HOSPITALIZATIONS_DISCHARGE);
  const canVoid = useCan(PERMISSION.HOSPITALIZATIONS_VOID);
  const canCreateEntry = useCan(PERMISSION.HOSPITALIZATION_ENTRIES_CREATE);
  const { activeMembership } = useAuth();
  const organization = useClinicalOrganization();
  const timezone = organization.data?.timezone ?? 'America/Bogota';
  const resource = useHospitalizationResource(hospitalizationId, true);
  const guard = useClinicalMutationGuard();
  const [actionError, setActionError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [dischargeOpen, setDischargeOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [dischargedAt, setDischargedAt] = useState(() =>
    currentLocalDateTime(new Date().toISOString(), timezone),
  );
  const [dischargeSummary, setDischargeSummary] = useState('');
  const [dischargeRecommendations, setDischargeRecommendations] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const episode = resource.data;

  async function runAction(action: () => Promise<unknown>) {
    setPending(true);
    setActionError(null);
    try {
      await action();
      if (guard.isCurrent()) {
        setActivateOpen(false);
        setDischargeOpen(false);
        setVoidOpen(false);
        resource.reload();
      }
    } catch (error) {
      if (guard.isCurrent()) setActionError(error);
    } finally {
      if (guard.isCurrent()) setPending(false);
    }
  }

  if (resource.loading)
    return (
      <Card>
        <LoadingState label="Cargando hospitalización" />
      </Card>
    );
  if (resource.error)
    return (
      <Card>
        <ResourceError error={resource.error} onRetry={resource.reload} />
      </Card>
    );
  if (!episode)
    return (
      <Card>
        <EmptyState
          title="Hospitalización no disponible"
          description="No se encontró el episodio en esta organización."
        />
      </Card>
    );

  const isResponsiblePractitioner =
    activeMembership?.clinicalRole === 'PRACTITIONER' &&
    activeMembership.id === episode.responsiblePractitionerMembershipId;
  const archived = episode.patient.status === 'ARCHIVED';
  const episodeLockedByParent = episode.parentEncounterStatus === 'VOIDED';
  const canEditEpisode =
    canUpdate &&
    !archived &&
    !episodeLockedByParent &&
    (episode.status === 'DRAFT' || episode.status === 'ACTIVE');

  return (
    <section className="page-stack hospitalization-page">
      <PageHeader
        eyebrow="Historia clínica · Hospitalización"
        title={episode.patientNameSnapshot ?? episode.patient.name}
        description={`Episodio · ${episode.admissionReason ?? 'Motivo de ingreso pendiente'}`}
        action={
          <span className="page-header__actions">
            {canEditEpisode ? (
              <Button
                as={Link}
                to={`/pacientes/${patientId}/historia/hospitalizaciones/${episode.id}/editar`}
                variant="secondary"
              >
                {episode.status === 'ACTIVE' ? 'Actualizar plan' : 'Editar borrador'}
              </Button>
            ) : null}
            <Button
              as={Link}
              to={`/pacientes/${patientId}/historia/hospitalizaciones`}
              variant="secondary"
            >
              Volver a hospitalizaciones
            </Button>
          </span>
        }
      />
      <Card className="hospitalization-status-card">
        <div className="detail-card__heading">
          <div>
            <p className="section-kicker">Estado del episodio</p>
            <h2>{STATUS_LABEL[episode.status]}</h2>
          </div>
          <span
            className={`hospitalization-status hospitalization-status--${episode.status.toLowerCase()}`}
          >
            {STATUS_LABEL[episode.status]}
          </span>
        </div>
        <p>
          Versión {episode.version} · {episode.entryCount} registros de Kardex
        </p>
      </Card>
      {archived ? (
        <Alert tone="warning" role="status">
          El paciente está archivado. El episodio se conserva para consulta histórica y no admite
          cambios, salvo anulación correctiva.
        </Alert>
      ) : null}
      {episodeLockedByParent ? (
        <Alert tone="warning" role="status">
          El encuentro padre está anulado. Este episodio no admite nuevas mutaciones; el historial
          se conserva y puede anularse con motivo.
        </Alert>
      ) : null}
      {episode.status === 'DRAFT' ? (
        <Alert tone="info" role="status">
          Este ingreso todavía es un borrador; no representa una hospitalización activa.
        </Alert>
      ) : null}
      {actionError ? (
        <Alert tone="error" role="alert">
          {actionError instanceof ApiError && actionError.status === 409
            ? 'El episodio fue modificado en otra sesión o cambió de estado. Recarga la versión actual antes de continuar.'
            : errorMessage(actionError, 'No fue posible completar la acción.')}
          {actionError instanceof ApiError && actionError.status === 409 ? (
            <Button type="button" variant="secondary" onClick={resource.reload}>
              Recargar episodio
            </Button>
          ) : null}
        </Alert>
      ) : null}
      <div className="detail-grid">
        <Card className="detail-card">
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Ingreso</p>
              <h2>Contexto y plan</h2>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Paciente</dt>
              <dd>
                {episode.patientNameSnapshot ?? episode.patient.name}
                {episode.patientNameSnapshot ? (
                  <span className="inline-note">Snapshot de activación</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Propietario al activar</dt>
              <dd>{episode.ownerDisplayNameSnapshot ?? 'Se fija al activar'}</dd>
            </div>
            <div>
              <dt>Profesional al activar</dt>
              <dd>
                {episode.professionalDisplayNameSnapshot ?? 'Se fija al activar'}
                {episode.professionalLicenseSnapshot
                  ? ` · ${episode.professionalLicenseSnapshot}`
                  : ''}
              </dd>
            </div>
            <div>
              <dt>Ingreso</dt>
              <dd>
                {episode.admittedAt ? formatDateTime(episode.admittedAt, timezone) : 'Pendiente'}
              </dd>
            </div>
            <div>
              <dt>Ubicación</dt>
              <dd>{episode.locationName ?? 'Pendiente'}</dd>
            </div>
            <div>
              <dt>Responsable</dt>
              <dd>
                {episode.professionalDisplayNameSnapshot ??
                  (episode.responsiblePractitionerMembershipId
                    ? 'Responsable asignado'
                    : 'Sin asignar')}
              </dd>
            </div>
            <div>
              <dt>Motivo</dt>
              <dd className="clinical-prose">{episode.admissionReason ?? 'Pendiente'}</dd>
            </div>
            <div>
              <dt>Diagnóstico</dt>
              <dd className="clinical-prose">{episode.diagnosis ?? 'Pendiente'}</dd>
            </div>
            <div>
              <dt>Tratamiento</dt>
              <dd className="clinical-prose">{episode.treatmentPlan ?? 'Sin indicaciones'}</dd>
            </div>
            <div>
              <dt>Medicamentos</dt>
              <dd className="clinical-prose">{episode.medicationsText ?? 'Sin indicaciones'}</dd>
            </div>
            <div>
              <dt>Dieta</dt>
              <dd className="clinical-prose">{episode.dietInstructions ?? 'Sin indicaciones'}</dd>
            </div>
            {episode.notes ? (
              <div>
                <dt>Notas</dt>
                <dd className="clinical-prose">{episode.notes}</dd>
              </div>
            ) : null}
          </dl>
        </Card>
        <Card className="hospitalization-actions">
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Flujo operativo</p>
              <h2>Acciones disponibles</h2>
            </div>
          </div>
          {episode.status === 'DRAFT' &&
          canActivate &&
          isResponsiblePractitioner &&
          !archived &&
          !episodeLockedByParent ? (
            <Button type="button" onClick={() => setActivateOpen(true)}>
              Activar hospitalización
            </Button>
          ) : null}
          {episode.status === 'DRAFT' && canActivate && !isResponsiblePractitioner ? (
            <p className="clinical-muted">
              Solo el Practitioner responsable puede activar este ingreso.
            </p>
          ) : null}
          {episode.status === 'ACTIVE' && canDischarge && !archived && !episodeLockedByParent ? (
            <Button
              type="button"
              onClick={() => {
                setDischargedAt(defaultDischargeDateTime(episode.admittedAt, timezone));
                setDischargeOpen(true);
              }}
            >
              Dar de alta
            </Button>
          ) : null}
          {(episode.status === 'ACTIVE' || episode.status === 'DISCHARGED') && canVoid ? (
            <Button type="button" variant="danger" onClick={() => setVoidOpen(true)}>
              Anular episodio
            </Button>
          ) : null}
          {episode.status === 'DISCHARGED' ? (
            <Alert tone="success" role="status">
              El alta cierra el episodio. Los datos y el Kardex se conservan en modo de solo
              lectura.
            </Alert>
          ) : null}
          {episode.status === 'VOIDED' ? (
            <Alert tone="warning" role="status">
              Motivo de anulación: {episode.voidReason}
            </Alert>
          ) : null}
          {episode.status === 'DISCHARGED' && episode.dischargedAt ? (
            <p>Alta registrada: {formatDateTime(episode.dischargedAt, timezone)}</p>
          ) : null}
          <Button
            as={Link}
            to={`/pacientes/${patientId}/historia/encuentros/${episode.clinicalEncounterId}`}
            variant="secondary"
          >
            Ver encuentro padre
          </Button>
        </Card>
      </div>
      <HospitalizationKardex
        hospitalizationId={episode.id}
        status={episode.status}
        timezone={timezone}
        canCreateEntry={canCreateEntry && !archived && !episodeLockedByParent}
        version={episode.version}
        onChanged={resource.reload}
      />
      <Modal
        open={activateOpen}
        onClose={() => setActivateOpen(false)}
        title="Activar hospitalización"
        eyebrow="Confirmación"
        description="Al activar, el paciente quedará hospitalizado y se fijarán los snapshots históricos de paciente, propietario y profesional."
      >
        <div className="modal-actions">
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              void runAction(() =>
                hospitalizationsApi.activate(
                  episode.id,
                  { expectedVersion: episode.version },
                  guard.signal(),
                ),
              )
            }
          >
            Confirmar activación
          </Button>
          <Button type="button" variant="secondary" onClick={() => setActivateOpen(false)}>
            Volver
          </Button>
        </div>
      </Modal>
      <Modal
        open={dischargeOpen}
        onClose={() => setDischargeOpen(false)}
        title="Registrar alta"
        eyebrow="Cierre clínico"
        description="El alta cierra este episodio. Después solo podrá consultarse o anularse preservando el historial."
      >
        <form
          className="domain-form"
          onSubmit={(event) => {
            event.preventDefault();
            void runAction(() =>
              hospitalizationsApi.discharge(
                episode.id,
                {
                  expectedVersion: episode.version,
                  dischargedAt: asInstant(dischargedAt, timezone),
                  dischargeSummary: dischargeSummary.trim() || null,
                  dischargeRecommendations: dischargeRecommendations.trim() || null,
                },
                guard.signal(),
              ),
            );
          }}
        >
          <FormField
            label="Fecha y hora del alta"
            htmlFor="hospitalization-discharge-at"
            hint={`Zona horaria: ${timezone}`}
          >
            <TextInput
              id="hospitalization-discharge-at"
              type="datetime-local"
              required
              value={dischargedAt}
              onChange={(event) => setDischargedAt(event.target.value)}
            />
          </FormField>
          <FormField label="Resumen de alta" htmlFor="hospitalization-discharge-summary">
            <textarea
              id="hospitalization-discharge-summary"
              className="input textarea"
              maxLength={10000}
              value={dischargeSummary}
              onChange={(event) => setDischargeSummary(event.target.value)}
            />
          </FormField>
          <FormField label="Recomendaciones" htmlFor="hospitalization-discharge-recommendations">
            <textarea
              id="hospitalization-discharge-recommendations"
              className="input textarea"
              maxLength={10000}
              value={dischargeRecommendations}
              onChange={(event) => setDischargeRecommendations(event.target.value)}
            />
          </FormField>
          <div className="modal-actions">
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando…' : 'Confirmar alta'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setDischargeOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={voidOpen}
        onClose={() => setVoidOpen(false)}
        title="Anular episodio"
        eyebrow="Acción correctiva"
        description="La anulación preserva el episodio y sus registros. Esta acción no se puede revertir."
      >
        <form
          className="domain-form"
          onSubmit={(event) => {
            event.preventDefault();
            void runAction(() =>
              hospitalizationsApi.void(
                episode.id,
                { expectedVersion: episode.version, reason: voidReason.trim() },
                guard.signal(),
              ),
            );
          }}
        >
          <FormField label="Motivo de anulación *" htmlFor="hospitalization-void-reason">
            <textarea
              id="hospitalization-void-reason"
              className="input textarea"
              maxLength={1000}
              required
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
            />
          </FormField>
          <div className="modal-actions">
            <Button type="submit" variant="danger" disabled={pending || !voidReason.trim()}>
              {pending ? 'Anulando…' : 'Confirmar anulación'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setVoidOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>
      {episode.status === 'VOIDED' ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigate(`/pacientes/${patientId}/historia/hospitalizaciones`)}
        >
          Volver al historial
        </Button>
      ) : null}
    </section>
  );
}
