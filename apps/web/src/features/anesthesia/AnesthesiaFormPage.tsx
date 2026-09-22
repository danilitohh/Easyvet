import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { useAuth } from '../../contexts/useAuth';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { TextInput } from '../../components/ui/TextInput';
import { ApiError } from '../../services/apiClient';
import { errorMessage } from '../shared/resourceUtils';
import { ResourceError } from '../shared/ResourceFeedback';
import { useActiveOrganizationId } from '../shared/hooks';
import {
  useClinicalEncounter,
  useClinicalMembers,
  useClinicalOrganization,
} from '../clinical/useClinical';
import {
  useAnesthesiaResource,
  useClinicalMutationGuard,
  useProcedureListResource,
} from '../shared/useClinicalDomainResource';
import { anesthesiaApi } from './anesthesiaApi';
import {
  emptyAnesthesiaForm,
  anesthesiaFormFromDetail,
  anesthesiaPayload,
  validateAnesthesiaTimes,
  type AnesthesiaFormState,
} from './anesthesiaUtils';

type Mode = 'create' | 'edit';
const TEXT_FIELDS = [
  ['asa', 'Clasificación ASA', 100],
  ['technique', 'Técnica anestésica', 10000],
  ['assessment', 'Evaluación preanestésica', 10000],
  ['medications', 'Medicamentos (texto libre)', 10000],
  ['airway', 'Manejo de vía aérea', 5000],
  ['fluids', 'Fluidos', 10000],
  ['complications', 'Complicaciones', 10000],
  ['recovery', 'Recuperación', 10000],
  ['notes', 'Notas', 10000],
] as const;

function TextArea({
  field,
  label,
  value,
  maxLength,
  disabled,
  onChange,
}: {
  field: string;
  label: string;
  value: string;
  maxLength: number;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <FormField label={label} htmlFor={`anesthesia-${field}`}>
      <textarea
        id={`anesthesia-${field}`}
        className="input input--textarea"
        maxLength={maxLength}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </FormField>
  );
}

// Draft forms keep optional values nullable and only require a valid interval when both timestamps exist.
export function AnesthesiaFormPage({ mode }: { mode: Mode }) {
  const { patientId, encounterId, anesthesiaRecordId } = useParams<{
    patientId: string;
    encounterId: string;
    anesthesiaRecordId: string;
  }>();
  const navigate = useNavigate();
  const { activeMembership } = useAuth();
  const canReadEncounter = useCan(PERMISSION.CLINICAL_ENCOUNTERS_READ);
  const canCreate = useCan(PERMISSION.ANESTHESIA_CREATE);
  const canUpdate = useCan(PERMISSION.ANESTHESIA_UPDATE_DRAFT);
  const canReadProcedures = useCan(PERMISSION.PROCEDURES_READ);
  const allowed = mode === 'create' ? canCreate : canUpdate;
  const organization = useClinicalOrganization();
  const encounter = useClinicalEncounter(
    mode === 'create' ? encounterId : undefined,
    mode === 'create' && canReadEncounter,
  );
  const record = useAnesthesiaResource(
    mode === 'edit' ? anesthesiaRecordId : undefined,
    mode === 'edit' && canUpdate,
  );
  const members = useClinicalMembers(allowed);
  const mutationGuard = useClinicalMutationGuard();
  const organizationId = useActiveOrganizationId();
  const [form, setForm] = useState<AnesthesiaFormState>(() => emptyAnesthesiaForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [baseline, setBaseline] = useState('');
  const initializedRef = useRef(false);
  const timezone = organization.data?.timezone ?? 'UTC';
  const item = record.data;
  const encounterForContext = mode === 'create' ? encounter.data : item?.encounter;
  const patientContext = mode === 'create' ? encounter.data?.patientId : item?.patientId;
  const procedures = useProcedureListResource(
    patientContext,
    1,
    allowed && canReadProcedures && Boolean(patientContext),
    encounterForContext?.id,
  );

  // A tenant switch clears draft identifiers and local values, not just the network cache.
  useEffect(() => {
    setForm(emptyAnesthesiaForm());
    setError(null);
    setBaseline('');
    setLoadedId(null);
    setSaving(false);
    initializedRef.current = false;
  }, [organizationId]);

  useEffect(() => {
    if (!organization.loading && mode === 'edit' && item && item.id !== loadedId) {
      if (patientId && item.patientId !== patientId) return;
      const values = anesthesiaFormFromDetail(item, timezone);
      setForm(values);
      setBaseline(JSON.stringify(values));
      setLoadedId(item.id);
      initializedRef.current = true;
    }
  }, [item, loadedId, mode, organization.loading, patientId, timezone]);
  useEffect(() => {
    if (
      mode === 'create' &&
      !initializedRef.current &&
      activeMembership?.clinicalRole === 'PRACTITIONER' &&
      encounter.data
    ) {
      setForm((current) => ({ ...current, responsibleId: activeMembership.id }));
      initializedRef.current = true;
    }
  }, [activeMembership, encounter.data, mode]);
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (
        (mode === 'create' && Object.values(form).some(Boolean)) ||
        (mode === 'edit' && JSON.stringify(form) !== baseline)
      )
        event.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [baseline, form, mode]);

  const practitionerOptions = useMemo(
    () => (members.data?.data ?? []).filter((member) => member.clinicalRole === 'PRACTITIONER'),
    [members.data],
  );
  const parentVoided =
    mode === 'create'
      ? encounterForContext?.status === 'VOIDED'
      : item?.parentEncounterStatus === 'VOIDED';
  const patientArchived =
    mode === 'create'
      ? encounter.data?.patient.status === 'ARCHIVED'
      : item?.patient.status === 'ARCHIVED';
  const canEdit =
    allowed &&
    (mode === 'create'
      ? Boolean(encounterForContext && !parentVoided && !patientArchived)
      : Boolean(item?.status === 'DRAFT' && !parentVoided && !patientArchived));

  function update<K extends keyof AnesthesiaFormState>(key: K, value: AnesthesiaFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  // Stale recovery is explicit: local edits stay visible until the user accepts server state.
  async function reloadCurrentDraft() {
    if (!anesthesiaRecordId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const current = await anesthesiaApi.findById(anesthesiaRecordId, mutationGuard.signal());
      if (!mutationGuard.isCurrent()) return;
      if (current.patientId !== patientId || current.status !== 'DRAFT') {
        record.reload();
        return;
      }
      const values = anesthesiaFormFromDetail(current, timezone);
      setForm(values);
      setBaseline(JSON.stringify(values));
      setLoadedId(current.id);
      record.reload();
    } catch (reloadError) {
      if (mutationGuard.isCurrent()) setError(reloadError);
    } finally {
      if (mutationGuard.isCurrent()) setSaving(false);
    }
  }
  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || saving) return;
    if (mode === 'edit' && JSON.stringify(form) === baseline) {
      setError(new Error('No hay cambios nuevos para guardar.'));
      return;
    }
    const timeError = validateAnesthesiaTimes(form, timezone);
    if (timeError) {
      setError(new Error(timeError));
      return;
    }
    const payload = anesthesiaPayload(form, timezone);
    setSaving(true);
    setError(null);
    try {
      const saved =
        mode === 'create'
          ? await anesthesiaApi.create(encounterId!, payload, mutationGuard.signal())
          : await anesthesiaApi.updateDraft(
              anesthesiaRecordId!,
              { ...payload, expectedVersion: item!.version },
              mutationGuard.signal(),
            );
      if (mutationGuard.isCurrent())
        navigate(`/pacientes/${patientId}/historia/anestesias/${saved.id}`, {
          replace: mode === 'create',
        });
    } catch (nextError) {
      if (mutationGuard.isCurrent()) setError(nextError);
    } finally {
      if (mutationGuard.isCurrent()) setSaving(false);
    }
  }

  if (!patientId || (mode === 'create' && !encounterId) || (mode === 'edit' && !anesthesiaRecordId))
    return (
      <ResourceError error={new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')} />
    );
  if (!allowed)
    return (
      <ResourceError
        error={new ApiError('No tienes permiso para editar este registro anestésico.', 403)}
      />
    );
  if (
    organization.loading ||
    (mode === 'create' && canReadEncounter && encounter.loading) ||
    (mode === 'edit' && record.loading) ||
    members.loading ||
    (canReadProcedures && procedures.loading)
  )
    return <LoadingState label="Cargando registro anestésico" />;
  if (organization.error)
    return <ResourceError error={organization.error} onRetry={organization.reload} />;
  if (members.error) return <ResourceError error={members.error} onRetry={members.reload} />;
  if (mode === 'create' && (!encounter.data || encounter.data.patientId !== patientId))
    return (
      <ResourceError
        error={encounter.error ?? new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')}
        onRetry={encounter.reload}
      />
    );
  if (mode === 'edit' && (record.error || !item || (patientId && item.patientId !== patientId)))
    return (
      <ResourceError
        error={record.error ?? new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')}
        onRetry={record.reload}
      />
    );
  if (!canEdit)
    return (
      <ResourceError
        error={
          new ApiError(
            'Este registro no se puede editar. Solo borradores de pacientes y consultas activos admiten cambios.',
            409,
          )
        }
      />
    );

  return (
    <div className="page-stack clinical-page clinical-domain-page">
      <PageHeader
        eyebrow={mode === 'create' ? 'Nuevo registro anestésico' : 'Editar borrador'}
        title={mode === 'create' ? 'Registrar anestesia' : 'Editar anestesia'}
        description={`Las fechas usan la zona horaria de la organización (${timezone}). Guardar mantiene el registro como borrador.`}
        action={
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              if (window.confirm('¿Descartar cambios y volver a la consulta?')) navigate(-1);
            }}
          >
            Volver
          </Button>
        }
      />
      {parentVoided ? (
        <Alert tone="warning" role="status">
          La consulta asociada fue anulada. No se permite editar ni finalizar este borrador.
        </Alert>
      ) : null}
      {mode === 'edit' && item?.linkedProcedureStatus === 'VOIDED' && canReadProcedures ? (
        <Alert tone="warning" role="status">
          El procedimiento asociado fue anulado. Cambia o limpia el vínculo antes de guardar o
          finalizar este borrador.
        </Alert>
      ) : null}
      {patientArchived ? (
        <Alert tone="warning" role="status">
          El paciente está archivado; no se permiten cambios en este borrador.
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="error" role="alert">
          {error instanceof ApiError && error.code === 'ANESTHESIA_STALE' ? (
            <>
              El registro cambió en otra sesión. Tus datos siguen aquí;{' '}
              <button
                className="link-button"
                type="button"
                onClick={() => void reloadCurrentDraft()}
              >
                recargar la versión actual
              </button>{' '}
              cuando decidas descartar tus cambios.
            </>
          ) : (
            errorMessage(error, 'No se pudo guardar el borrador.')
          )}
        </Alert>
      ) : null}
      <form className="clinical-domain-form" onSubmit={(event) => void saveDraft(event)}>
        <Card>
          <div className="clinical-domain-form__grid">
            <FormField label="Inicio" htmlFor="anesthesia-start-date">
              <TextInput
                id="anesthesia-start-date"
                type="date"
                value={form.startedDate}
                disabled={saving}
                onChange={(event) => update('startedDate', event.target.value)}
              />
            </FormField>
            <FormField label="Hora de inicio" htmlFor="anesthesia-start-time">
              <TextInput
                id="anesthesia-start-time"
                type="time"
                value={form.startedTime}
                disabled={saving}
                onChange={(event) => update('startedTime', event.target.value)}
              />
            </FormField>
            <FormField label="Fin" htmlFor="anesthesia-end-date">
              <TextInput
                id="anesthesia-end-date"
                type="date"
                value={form.endedDate}
                disabled={saving}
                onChange={(event) => update('endedDate', event.target.value)}
              />
            </FormField>
            <FormField label="Hora de finalización" htmlFor="anesthesia-end-time">
              <TextInput
                id="anesthesia-end-time"
                type="time"
                value={form.endedTime}
                disabled={saving}
                onChange={(event) => update('endedTime', event.target.value)}
              />
            </FormField>
            <FormField label="Profesional responsable" htmlFor="anesthesia-responsible">
              <select
                id="anesthesia-responsible"
                className="input"
                value={form.responsibleId}
                disabled={saving}
                onChange={(event) => update('responsibleId', event.target.value)}
              >
                <option value="">Sin asignar</option>
                {practitionerOptions.map((member) => (
                  <option key={member.membershipId} value={member.membershipId}>
                    {member.displayName || 'Profesional sin perfil'}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Procedimiento relacionado (opcional)" htmlFor="anesthesia-procedure">
              {canReadProcedures ? (
                <select
                  id="anesthesia-procedure"
                  className="input"
                  value={form.procedureId}
                  disabled={saving}
                  onChange={(event) => update('procedureId', event.target.value)}
                >
                  <option value="">Sin procedimiento relacionado</option>
                  {item?.linkedProcedureStatus === 'VOIDED' &&
                  form.procedureId === item.clinicalProcedureId ? (
                    <option value={item.clinicalProcedureId}>
                      Procedimiento asociado anulado — selecciona otro o limpia el vínculo
                    </option>
                  ) : null}
                  {(procedures.data?.data ?? [])
                    .filter(
                      (procedure) =>
                        procedure.status === 'DRAFT' || procedure.status === 'FINALIZED',
                    )
                    .map((procedure) => (
                      <option key={procedure.id} value={procedure.id}>
                        {procedure.procedureName ||
                          (procedure.kind === 'SURGERY' ? 'Cirugía' : 'Procedimiento')}{' '}
                        · {procedure.status === 'DRAFT' ? 'Borrador' : 'Finalizado'}
                      </option>
                    ))}
                </select>
              ) : (
                <span className="form-field__hint" id="anesthesia-procedure">
                  {form.procedureId
                    ? 'Este registro conserva una asociación existente, pero no se puede consultar ni modificar sin permiso de lectura de procedimientos.'
                    : 'La asociación opcional no está disponible sin permiso de lectura de procedimientos.'}
                </span>
              )}
            </FormField>
          </div>
          {TEXT_FIELDS.map(([key, label, maxLength]) => (
            <TextArea
              key={key}
              field={key}
              label={label}
              value={form[key]}
              maxLength={maxLength}
              disabled={saving}
              onChange={(value) => update(key, value)}
            />
          ))}
          {form.responsibleId &&
          practitionerOptions.find((member) => member.membershipId === form.responsibleId)
            ?.profileConfigured === false ? (
            <Alert tone="warning" role="status">
              El profesional responsable debe completar su perfil antes de finalizar.
            </Alert>
          ) : null}
        </Card>
        <div className="modal-actions">
          <Button
            variant="secondary"
            type="button"
            disabled={saving}
            onClick={() => {
              if (window.confirm('¿Descartar cambios y volver a la consulta?')) navigate(-1);
            }}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar borrador'}
          </Button>
        </div>
      </form>
    </div>
  );
}
