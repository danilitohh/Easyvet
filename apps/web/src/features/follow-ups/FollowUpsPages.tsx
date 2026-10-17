import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { ClinicalFollowUpDetail } from '@veterinary-saas/contracts';
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
import { Select } from '../../components/ui/Select';
import { TextInput } from '../../components/ui/TextInput';
import { ApiError } from '../../services/apiClient';
import { usePatient } from '../patients/usePatients';
import { useClinicalOrganization } from '../clinical/useClinical';
import {
  useClinicalMutationGuard,
  useFollowUpEncounterOptions,
  useFollowUpListResource,
  useFollowUpMembersResource,
  useFollowUpResource,
} from '../shared/useClinicalDomainResource';
import {
  civilDateFromDate,
  civilFieldsFromInstant,
  instantFromCivil,
  nextCivilDate,
} from '../agenda/agendaUtils';
import { followUpsApi } from './followUpsApi';
import { FollowUpSummaryRow } from './FollowUpSummaryRow';
import { dueState, formatFollowUpLocal } from './followUpViewUtils';
import { useActiveOrganizationId } from '../shared/hooks';
import './follow-ups.css';

const FOLLOW_UP_MUTATED_EVENT = 'easyvet:follow-up-mutated';
type QueueFilter = 'open' | 'overdue' | 'today' | 'upcoming' | 'reminders';

// A domain mutation prompts currently mounted queue and dashboard widgets to refresh once.
function notifyFollowUpMutation(): void {
  window.dispatchEvent(new Event(FOLLOW_UP_MUTATED_EVENT));
}

// API errors are translated without exposing transport or database details to the clinical user.
function messageFor(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  if (error.code === 'FOLLOW_UP_STALE')
    return 'El seguimiento cambió en otra sesión. Recarga explícitamente antes de guardar.';
  if (error.code === 'PATIENT_ARCHIVED')
    return 'El paciente está archivado; solo puedes consultar el historial o anular este seguimiento.';
  if (error.code === 'SOURCE_CLINICAL_ENCOUNTER_VOIDED')
    return 'La consulta clínica asociada fue anulada. Este seguimiento no puede continuar.';
  if (error.code === 'PROFESSIONAL_PROFILE_REQUIRED')
    return 'Completa tu perfil profesional antes de finalizar seguimientos.';
  return error.message || fallback;
}

// The global queue defaults to OPEN and keeps computed date filters out of persisted status values.
export function FollowUpsPage() {
  const [filter, setFilter] = useState<QueueFilter>('open');
  const organization = useClinicalOrganization();
  const timezone = organization.data?.timezone ?? 'UTC';
  const today = civilDateFromDate(new Date(), timezone);
  const query = useMemo(() => {
    const base = { page: 1, pageSize: 100, status: 'OPEN' as const, sort: 'due_asc' as const };
    if (filter === 'overdue')
      return { ...base, dueTo: today === '0001-01-01' ? today : previousCivilDate(today) };
    if (filter === 'today') return { ...base, dueFrom: today, dueTo: today };
    if (filter === 'upcoming')
      return {
        ...base,
        dueFrom: nextCivilDate(today),
        dueTo: addCivilDays(nextCivilDate(today), 6),
      };
    if (filter === 'reminders') return { ...base, reminderBefore: new Date().toISOString() };
    return base;
  }, [filter, today]);
  const state = useFollowUpListResource(query, true);
  const reload = state.reload;
  useEffect(() => {
    window.addEventListener(FOLLOW_UP_MUTATED_EVENT, reload);
    return () => window.removeEventListener(FOLLOW_UP_MUTATED_EVENT, reload);
  }, [reload]);

  return (
    <div className="page-stack follow-ups-page">
      <PageHeader
        eyebrow="Seguimiento clínico"
        title="Seguimientos"
        description="Pendientes de cuidado y recordatorios internos de la organización."
        action={
          <Button as={Link} to="/pacientes">
            Buscar paciente
          </Button>
        }
      />
      {organization.error ? (
        <Alert tone="warning" role="status">
          No se pudo consultar la zona horaria; se muestra UTC.
        </Alert>
      ) : null}
      <Card>
        <div
          className="follow-up-filter-list"
          role="group"
          aria-label="Filtrar seguimientos abiertos"
        >
          {(
            [
              ['open', 'Todos abiertos'],
              ['overdue', 'Vencidos'],
              ['today', 'Hoy'],
              ['upcoming', 'Próximos'],
              ['reminders', 'Recordatorios'],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              variant={filter === key ? 'primary' : 'secondary'}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        {state.loading ? <LoadingState label="Cargando seguimientos" /> : null}
        {state.error ? (
          <Alert tone="error" role="alert">
            No fue posible cargar los seguimientos.{' '}
            <Button type="button" variant="secondary" onClick={state.reload}>
              Reintentar
            </Button>
          </Alert>
        ) : null}
        {!state.loading && !state.error && state.data?.data.length === 0 ? (
          <EmptyState
            title="No hay seguimientos para este filtro"
            description="Puedes crear uno desde la historia de un paciente."
          />
        ) : null}
        {state.data?.data.length ? (
          <div className="follow-up-list">
            {state.data.data.map((item) => (
              <FollowUpSummaryRow key={item.id} item={item} timezone={timezone} today={today} />
            ))}
          </div>
        ) : null}
        {state.data?.pagination.total ? (
          <p className="follow-up-total">
            {state.data.pagination.total} seguimientos · ordenados por vencimiento
          </p>
        ) : null}
      </Card>
    </div>
  );
}

// Patient history intentionally includes OPEN, COMPLETED and VOIDED records.
export function PatientFollowUpsPage() {
  const { patientId = '' } = useParams();
  const canCreate = useCan(PERMISSION.FOLLOW_UPS_CREATE);
  const patientState = usePatient(patientId);
  const organization = useClinicalOrganization();
  const timezone = organization.data?.timezone ?? 'UTC';
  const today = civilDateFromDate(new Date(), timezone);
  const state = useFollowUpListResource(
    { page: 1, pageSize: 100, sort: 'due_desc' },
    Boolean(patientId),
    patientId,
  );
  const reload = state.reload;
  useEffect(() => {
    window.addEventListener(FOLLOW_UP_MUTATED_EVENT, reload);
    return () => window.removeEventListener(FOLLOW_UP_MUTATED_EVENT, reload);
  }, [reload]);
  if (state.loading && !state.data)
    return <LoadingState label="Cargando seguimientos del paciente" />;
  return (
    <div className="page-stack follow-ups-page">
      <PageHeader
        eyebrow="Historia clínica · Seguimientos"
        title={patientState.patient?.name ?? 'Seguimientos del paciente'}
        description="Historial completo de tareas de seguimiento y sus cambios de estado."
        action={
          <span className="page-header__actions">
            <Button as={Link} to={`/pacientes/${patientId}/historia`} variant="secondary">
              Volver a historia
            </Button>
            {canCreate && patientState.patient?.status === 'ACTIVE' ? (
              <Button as={Link} to={`/pacientes/${patientId}/seguimientos/nuevo`}>
                Nuevo seguimiento
              </Button>
            ) : null}
          </span>
        }
      />
      {patientState.patient?.status === 'ARCHIVED' ? (
        <Alert tone="warning" role="status">
          Paciente archivado: el historial es de solo lectura; los seguimientos abiertos pueden
          anularse.
        </Alert>
      ) : null}
      {state.error ? (
        <Alert tone="error" role="alert">
          No fue posible cargar el historial.{' '}
          <Button type="button" variant="secondary" onClick={state.reload}>
            Reintentar
          </Button>
        </Alert>
      ) : null}
      {!state.loading && !state.error && !state.data?.data.length ? (
        <Card>
          <EmptyState
            title="Sin seguimientos registrados"
            description="Los seguimientos vinculados al paciente aparecerán aquí."
          />
        </Card>
      ) : null}
      {state.data?.data.length ? (
        <Card>
          <div className="follow-up-list">
            {state.data.data.map((item) => (
              <FollowUpSummaryRow key={item.id} item={item} timezone={timezone} today={today} />
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

// Form state is retained on conflicts until the user explicitly reloads the latest server version.
export function FollowUpFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { patientId = '', followUpId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const organizationId = useActiveOrganizationId();
  const initialSourceApplied = useRef(false);
  const canCreate = useCan(PERMISSION.FOLLOW_UPS_CREATE);
  const canUpdate = useCan(PERMISSION.FOLLOW_UPS_UPDATE);
  const canReadEncounters = useCan(PERMISSION.CLINICAL_ENCOUNTERS_READ);
  const mutationGuard = useClinicalMutationGuard();
  const detail = useFollowUpResource(mode === 'edit' ? followUpId : undefined, mode === 'edit');
  const resolvedPatientId = mode === 'edit' ? detail.data?.patientId : patientId;
  const patientState = usePatient(resolvedPatientId);
  const organization = useClinicalOrganization();
  const timezone = organization.data?.timezone ?? 'UTC';
  const members = useFollowUpMembersResource(Boolean(resolvedPatientId));
  const encounters = useFollowUpEncounterOptions(resolvedPatientId, canReadEncounters);
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [dueOn, setDueOn] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [assignedMembershipId, setAssignedMembershipId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (mode !== 'edit' || !detail.data) return;
    setTitle(detail.data.title);
    setReason(detail.data.reason ?? '');
    setDueOn(detail.data.dueOn);
    const local = detail.data.reminderAt
      ? civilFieldsFromInstant(detail.data.reminderAt, timezone)
      : null;
    setReminderDate(local?.date ?? '');
    setReminderTime(local?.time ?? '');
    setAssignedMembershipId(detail.data.assignedMembershipId ?? '');
    setSourceId(detail.data.sourceClinicalEncounterId ?? '');
    setNotes(detail.data.notes ?? '');
  }, [mode, detail.data, timezone]);
  useEffect(() => {
    setTitle('');
    setReason('');
    setDueOn('');
    setReminderDate('');
    setReminderTime('');
    setAssignedMembershipId('');
    setSourceId('');
    setNotes('');
    setError(null);
  }, [organizationId]);
  useEffect(() => {
    if (mode === 'create' && !initialSourceApplied.current) {
      initialSourceApplied.current = true;
      setSourceId(searchParams.get('sourceClinicalEncounterId') ?? '');
    }
  }, [mode, searchParams]);

  const linkedSourceVoided = mode === 'edit' && detail.data?.sourceEncounter?.status === 'VOIDED';
  const archived = (patientState.patient ?? detail.data?.patient)?.status === 'ARCHIVED';
  const canSubmit = mode === 'create' ? canCreate : canUpdate;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || saving || archived || linkedSourceVoided) return;
    if (Boolean(reminderDate) !== Boolean(reminderTime)) {
      setError(
        new ApiError('Indica fecha y hora del recordatorio, o deja ambos campos vacíos.', 400),
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const reminderAt =
        reminderDate && reminderTime
          ? instantFromCivil(reminderDate, reminderTime, timezone)
          : null;
      const common = {
        title: title.trim(),
        reason: reason.trim() || null,
        dueOn,
        reminderAt,
        assignedMembershipId: assignedMembershipId || null,
        sourceClinicalEncounterId: sourceId || null,
        notes: notes.trim() || null,
      };
      const saved =
        mode === 'create'
          ? await followUpsApi.create(patientId, common, mutationGuard.signal())
          : await followUpsApi.update(
              followUpId,
              { ...common, expectedVersion: detail.data!.version },
              mutationGuard.signal(),
            );
      if (!mutationGuard.isCurrent()) return;
      notifyFollowUpMutation();
      navigate(`/seguimientos/${saved.id}`);
    } catch (requestError) {
      if (mutationGuard.isCurrent()) setError(requestError);
    } finally {
      if (mutationGuard.isCurrent()) setSaving(false);
    }
  };

  if (mode === 'edit' && detail.loading && !detail.data)
    return <LoadingState label="Cargando seguimiento" />;
  if (mode === 'edit' && detail.error)
    return (
      <Alert tone="error" role="alert">
        No fue posible cargar el seguimiento.{' '}
        <Button type="button" variant="secondary" onClick={detail.reload}>
          Reintentar
        </Button>
      </Alert>
    );
  if (mode === 'create' && patientState.loading) return <LoadingState label="Cargando paciente" />;

  return (
    <div className="page-stack follow-ups-page">
      <PageHeader
        eyebrow="Seguimiento clínico"
        title={mode === 'create' ? 'Nuevo seguimiento' : 'Editar seguimiento'}
        description={`Fecha de vencimiento civil; recordatorio en ${timezone}.`}
        action={
          <Button
            as={Link}
            to={
              mode === 'edit'
                ? `/seguimientos/${followUpId}`
                : `/pacientes/${patientId}/historia/seguimientos`
            }
            variant="secondary"
          >
            Cancelar
          </Button>
        }
      />
      {patientState.patient ? (
        <Card className="follow-up-patient">
          <strong>{patientState.patient.name}</strong>
          <span>
            {patientState.patient.species} ·{' '}
            {patientState.patient.status === 'ACTIVE' ? 'Activo' : 'Archivado'}
          </span>
        </Card>
      ) : null}
      {archived ? (
        <Alert tone="warning" role="status">
          Paciente archivado: no se pueden crear ni editar seguimientos.
        </Alert>
      ) : null}
      {linkedSourceVoided ? (
        <Alert tone="warning" role="status">
          La consulta clínica asociada fue anulada. Este seguimiento no puede continuar.
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="error" role="alert">
          {messageFor(error, 'No fue posible guardar el seguimiento.')}
        </Alert>
      ) : null}
      {members.error ? (
        <Alert tone="warning" role="status">
          No se pudo cargar la lista de profesionales y asistentes; puedes guardar sin asignar.
        </Alert>
      ) : null}
      <Card>
        <form className="domain-form follow-up-form" onSubmit={(event) => void submit(event)}>
          <div className="form-grid form-grid--two">
            <FormField label="Título *" htmlFor="follow-up-title">
              <TextInput
                id="follow-up-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                required
                disabled={!canSubmit || archived || linkedSourceVoided}
              />
            </FormField>
            <FormField label="Vence el *" htmlFor="follow-up-due">
              <TextInput
                id="follow-up-due"
                type="date"
                value={dueOn}
                onChange={(event) => setDueOn(event.target.value)}
                required
                disabled={!canSubmit || archived || linkedSourceVoided}
              />
            </FormField>
            <FormField
              label="Asignado a"
              htmlFor="follow-up-assignee"
              hint="Profesional o asistente clínico; no se muestran datos de contacto."
            >
              <Select
                id="follow-up-assignee"
                value={assignedMembershipId}
                onChange={(event) => setAssignedMembershipId(event.target.value)}
                disabled={!canSubmit || archived || linkedSourceVoided || members.loading}
              >
                <option value="">Sin asignar</option>
                {(members.data?.data ?? [])
                  .filter(
                    (member) =>
                      member.clinicalRole === 'PRACTITIONER' ||
                      member.clinicalRole === 'CLINICAL_ASSISTANT',
                  )
                  .map((member) => (
                    <option key={member.membershipId} value={member.membershipId}>
                      {member.displayName ?? 'Perfil sin nombre'} ·{' '}
                      {member.clinicalRole === 'PRACTITIONER' ? 'Profesional' : 'Asistente'}
                    </option>
                  ))}
              </Select>
            </FormField>
            <FormField
              label="Consulta relacionada"
              htmlFor="follow-up-source"
              hint="Opcional; solo borradores y consultas finalizadas del paciente."
            >
              <Select
                id="follow-up-source"
                value={sourceId}
                onChange={(event) => setSourceId(event.target.value)}
                disabled={
                  !canReadEncounters ||
                  !canSubmit ||
                  archived ||
                  linkedSourceVoided ||
                  encounters.loading
                }
              >
                <option value="">Sin consulta relacionada</option>
                {(encounters.data?.data ?? [])
                  .filter((item) => item.status === 'DRAFT' || item.status === 'FINALIZED')
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.occurredAt.slice(0, 10)} · {item.reason} ·{' '}
                      {item.status === 'DRAFT' ? 'Borrador' : 'Finalizada'}
                    </option>
                  ))}
              </Select>
            </FormField>
            <FormField label="Motivo" htmlFor="follow-up-reason">
              <TextInput
                id="follow-up-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={2000}
                disabled={!canSubmit || archived || linkedSourceVoided}
              />
            </FormField>
            <div className="follow-up-reminder-fields">
              <FormField
                label="Fecha del recordatorio"
                htmlFor="follow-up-reminder-date"
                hint={`Hora local ${timezone}; déjala vacía para quitarlo.`}
              >
                <TextInput
                  id="follow-up-reminder-date"
                  type="date"
                  value={reminderDate}
                  onChange={(event) => setReminderDate(event.target.value)}
                  disabled={!canSubmit || archived || linkedSourceVoided}
                />
              </FormField>
              <FormField label="Hora" htmlFor="follow-up-reminder-time">
                <TextInput
                  id="follow-up-reminder-time"
                  type="time"
                  value={reminderTime}
                  onChange={(event) => setReminderTime(event.target.value)}
                  disabled={!canSubmit || archived || linkedSourceVoided}
                />
              </FormField>
            </div>
            <FormField label="Notas" htmlFor="follow-up-notes">
              <textarea
                className="input input--textarea"
                id="follow-up-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={20000}
                rows={5}
                disabled={!canSubmit || archived || linkedSourceVoided}
              />
            </FormField>
          </div>
          {encounters.error ? (
            <Alert tone="warning" role="status">
              No se pudo cargar el selector de consultas; puedes continuar sin una consulta
              vinculada.
            </Alert>
          ) : null}
          <div className="form-actions">
            <Button
              type="submit"
              disabled={!canSubmit || saving || archived || linkedSourceVoided || !dueOn}
            >
              {saving ? 'Guardando…' : mode === 'create' ? 'Crear seguimiento' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// Lifecycle dialogs require explicit clinical text and refresh every mounted follow-up surface.
function FollowUpActionDialogs({
  record,
  onSaved,
}: {
  record: ClinicalFollowUpDetail;
  onSaved: () => void;
}) {
  const canComplete = useCan(PERMISSION.FOLLOW_UPS_COMPLETE);
  const canVoid = useCan(PERMISSION.FOLLOW_UPS_VOID);
  const { activeMembership } = useAuth();
  const guard = useClinicalMutationGuard();
  const [dialog, setDialog] = useState<'complete' | 'void' | null>(null);
  const [outcome, setOutcome] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const close = useCallback(() => {
    setDialog(null);
    setError(null);
  }, []);
  const archived = record.patient.status === 'ARCHIVED';
  const parentVoided = record.sourceEncounter?.status === 'VOIDED';
  const canFinish =
    canComplete &&
    activeMembership?.clinicalRole === 'PRACTITIONER' &&
    record.status === 'OPEN' &&
    !archived &&
    !parentVoided;
  const canCancel = canVoid && (record.status === 'OPEN' || record.status === 'COMPLETED');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dialog || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (dialog === 'complete')
        await followUpsApi.complete(
          record.id,
          {
            expectedVersion: record.version,
            outcome,
            completionNotes: completionNotes.trim() || null,
          },
          guard.signal(),
        );
      else
        await followUpsApi.void(
          record.id,
          { expectedVersion: record.version, reason: voidReason },
          guard.signal(),
        );
      if (!guard.isCurrent()) return;
      notifyFollowUpMutation();
      close();
      onSaved();
    } catch (requestError) {
      if (guard.isCurrent()) setError(requestError);
    } finally {
      if (guard.isCurrent()) setSaving(false);
    }
  };
  return (
    <>
      <div className="follow-up-actions">
        {canFinish ? (
          <Button onClick={() => setDialog('complete')}>Completar seguimiento</Button>
        ) : null}
        {canCancel ? (
          <Button variant="danger" onClick={() => setDialog('void')}>
            Anular seguimiento
          </Button>
        ) : null}
      </div>
      <Modal
        open={dialog === 'complete'}
        title="Completar seguimiento"
        description="Registra el resultado clínico; la acción no crea una consulta ni una evolución."
        onClose={close}
      >
        <form className="domain-form" onSubmit={(event) => void submit(event)}>
          {error ? (
            <Alert tone="error" role="alert">
              {messageFor(error, 'No fue posible completar el seguimiento.')}
            </Alert>
          ) : null}
          <FormField label="Resultado *" htmlFor="follow-up-outcome">
            <textarea
              className="input input--textarea"
              id="follow-up-outcome"
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
              maxLength={4000}
              rows={4}
              required
            />
          </FormField>
          <FormField label="Notas de finalización" htmlFor="follow-up-completion-notes">
            <textarea
              className="input input--textarea"
              id="follow-up-completion-notes"
              value={completionNotes}
              onChange={(event) => setCompletionNotes(event.target.value)}
              maxLength={20000}
              rows={3}
            />
          </FormField>
          <div className="form-actions">
            <Button type="submit" disabled={saving || !outcome.trim()}>
              {saving ? 'Guardando…' : 'Confirmar finalización'}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={dialog === 'void'}
        title="Anular seguimiento"
        description="Se conserva en el historial; no se elimina físicamente."
        onClose={close}
      >
        <form className="domain-form" onSubmit={(event) => void submit(event)}>
          {error ? (
            <Alert tone="error" role="alert">
              {messageFor(error, 'No fue posible anular el seguimiento.')}
            </Alert>
          ) : null}
          <FormField label="Motivo de anulación *" htmlFor="follow-up-void-reason">
            <textarea
              className="input input--textarea"
              id="follow-up-void-reason"
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              maxLength={2000}
              rows={4}
              required
            />
          </FormField>
          <div className="form-actions">
            <Button type="submit" variant="danger" disabled={saving || !voidReason.trim()}>
              {saving ? 'Guardando…' : 'Confirmar anulación'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// Detail links are tenant-safe deep links and reflect historical snapshots after completion.
export function FollowUpDetailPage() {
  const { followUpId = '' } = useParams();
  const canUpdate = useCan(PERMISSION.FOLLOW_UPS_UPDATE);
  const state = useFollowUpResource(followUpId, Boolean(followUpId));
  const organization = useClinicalOrganization();
  const timezone = organization.data?.timezone ?? 'UTC';
  if (state.loading && !state.data) return <LoadingState label="Cargando seguimiento" />;
  if (state.error)
    return (
      <div className="page-stack">
        <PageHeader
          eyebrow="Seguimiento clínico"
          title="Detalle del seguimiento"
          description="Consulta del seguimiento dentro de la organización activa."
        />
        <Alert tone="error" role="alert">
          El seguimiento no está disponible en esta organización.{' '}
          <Button as={Link} to="/seguimientos" variant="secondary">
            Volver a seguimientos
          </Button>
        </Alert>
      </div>
    );
  const record = state.data;
  if (!record) return null;
  const parentVoided = record.sourceEncounter?.status === 'VOIDED';
  const archived = record.patient.status === 'ARCHIVED';
  const due = dueState(record, civilDateFromDate(new Date(), timezone));
  const editable = canUpdate && record.status === 'OPEN' && !archived && !parentVoided;
  return (
    <div className="page-stack follow-ups-page">
      <PageHeader
        eyebrow="Seguimiento clínico"
        title={record.title}
        description={`${record.patient.name} · ${record.patient.species}`}
        action={
          <span className="page-header__actions">
            <Button
              as={Link}
              to={`/pacientes/${record.patientId}/historia/seguimientos`}
              variant="secondary"
            >
              Historial del paciente
            </Button>
            {editable ? (
              <Button as={Link} to={`/seguimientos/${record.id}/editar`}>
                Editar
              </Button>
            ) : null}
          </span>
        }
      />
      {parentVoided ? (
        <Alert tone="warning" role="status">
          La consulta clínica asociada fue anulada. Este seguimiento no puede continuar.
        </Alert>
      ) : null}
      {archived ? (
        <Alert tone="warning" role="status">
          El paciente está archivado. El registro se conserva como historial; solo se permite
          anularlo.
        </Alert>
      ) : null}
      <Card className="follow-up-detail-grid">
        <div>
          <p className="section-kicker">Estado</p>
          <Badge
            tone={
              record.status === 'OPEN'
                ? (due?.tone ?? 'neutral')
                : record.status === 'COMPLETED'
                  ? 'success'
                  : 'neutral'
            }
          >
            {record.status === 'OPEN'
              ? (due?.label ?? 'Abierto')
              : record.status === 'COMPLETED'
                ? 'Completado'
                : 'Anulado'}
          </Badge>
        </div>
        <div>
          <p className="section-kicker">Vencimiento</p>
          <strong>{record.dueOn}</strong>
          <small>Fecha civil de la organización</small>
        </div>
        <div>
          <p className="section-kicker">Recordatorio interno</p>
          <strong>
            {record.reminderAt
              ? formatFollowUpLocal(record.reminderAt, timezone)
              : 'Sin recordatorio'}
          </strong>
          {record.reminderDue ? <Badge tone="warning">Recordatorio pendiente</Badge> : null}
        </div>
        <div>
          <p className="section-kicker">Asignado a</p>
          <strong>{record.assignedMember?.displayName ?? 'Sin asignar'}</strong>
        </div>
        <div>
          <p className="section-kicker">Responsable actual</p>
          <strong>{record.patient.owner.displayName}</strong>
        </div>
        <div>
          <p className="section-kicker">Consulta relacionada</p>
          {record.sourceEncounter ? (
            <Link
              to={`/pacientes/${record.patientId}/historia/encuentros/${record.sourceEncounter.id}`}
            >
              {record.sourceEncounter.reason} · {record.sourceEncounter.status}
            </Link>
          ) : (
            <strong>Sin consulta relacionada</strong>
          )}
        </div>
        {record.reason ? (
          <div className="follow-up-detail-grid__wide">
            <p className="section-kicker">Motivo</p>
            <p>{record.reason}</p>
          </div>
        ) : null}
        {record.notes ? (
          <div className="follow-up-detail-grid__wide">
            <p className="section-kicker">Notas</p>
            <p className="follow-up-preformatted">{record.notes}</p>
          </div>
        ) : null}
      </Card>
      {record.status === 'COMPLETED' ? (
        <Card>
          <p className="section-kicker">Resultado</p>
          <h2>{record.outcome}</h2>
          {record.completionNotes ? (
            <p className="follow-up-preformatted">{record.completionNotes}</p>
          ) : null}
          <p>
            Completado {formatFollowUpLocal(record.completedAt, timezone)} por{' '}
            {record.professionalDisplayNameSnapshot ??
              record.completedBy?.displayName ??
              'Profesional'}
          </p>
          <p>
            Snapshot histórico: {record.patientNameSnapshot} · {record.ownerDisplayNameSnapshot}
          </p>
        </Card>
      ) : null}
      {record.status === 'VOIDED' ? (
        <Card>
          <p className="section-kicker">Anulación</p>
          <p>{record.voidReason}</p>
          <p>
            {formatFollowUpLocal(record.voidedAt, timezone)} ·{' '}
            {record.voidedBy?.displayName ?? 'Profesional'}
          </p>
          {record.outcome ? <p>Resultado previo: {record.outcome}</p> : null}
        </Card>
      ) : null}
      {record.status === 'OPEN' && !editable && !parentVoided && !archived ? (
        <Alert tone="info" role="status">
          Tu membresía puede consultar este seguimiento, pero no editarlo ni completarlo.
        </Alert>
      ) : null}
      <FollowUpActionDialogs record={record} onSaved={state.reload} />
    </div>
  );
}

// Small date helpers perform calendar arithmetic on strings rather than JavaScript Date parsing.
function previousCivilDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

// Upcoming ranges use UTC calendar arithmetic to avoid browser timezone and DST shifts.
function addCivilDays(value: string, days: number): string {
  let result = value;
  for (let offset = 0; offset < days; offset += 1) result = nextCivilDate(result);
  return result;
}
