import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ClinicalProcedureDetail } from '@veterinary-saas/contracts';
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
  useProcedureResource,
  useClinicalMutationGuard,
} from '../shared/useClinicalDomainResource';
import { proceduresApi } from './proceduresApi';
import {
  emptyProcedureForm,
  procedureFormFromDetail,
  procedurePayload,
  validateProcedureTimestamp,
  type ProcedureFormState,
} from './procedureUtils';

type Mode = 'create' | 'edit';
const PROCEDURE_TEXT_FIELDS = [
  ['procedureName', 'Nombre del procedimiento', 200],
  ['indication', 'Indicación', 5000],
  ['description', 'Descripción', 10000],
  ['technique', 'Técnica', 10000],
  ['findings', 'Hallazgos', 10000],
  ['complications', 'Complicaciones', 10000],
  ['recoveryNotes', 'Notas de recuperación', 10000],
  ['postoperativePlan', 'Plan posoperatorio', 10000],
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
    <FormField label={label} htmlFor={`procedure-${field}`}>
      <textarea
        id={`procedure-${field}`}
        className="input input--textarea"
        maxLength={maxLength}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </FormField>
  );
}

// The same editor handles create and Draft update without imposing finalization requirements on saves.
export function ProcedureFormPage({ mode }: { mode: Mode }) {
  const { patientId, encounterId, procedureId } = useParams<{
    patientId: string;
    encounterId: string;
    procedureId: string;
  }>();
  const navigate = useNavigate();
  const { activeMembership } = useAuth();
  const canReadEncounter = useCan(PERMISSION.CLINICAL_ENCOUNTERS_READ);
  const canCreate = useCan(PERMISSION.PROCEDURES_CREATE);
  const canUpdate = useCan(PERMISSION.PROCEDURES_UPDATE_DRAFT);
  const allowed = mode === 'create' ? canCreate : canUpdate;
  const organization = useClinicalOrganization();
  const encounter = useClinicalEncounter(
    mode === 'create' ? encounterId : undefined,
    mode === 'create' && canReadEncounter,
  );
  const procedure = useProcedureResource(
    mode === 'edit' ? procedureId : undefined,
    mode === 'edit' && canUpdate,
  );
  const members = useClinicalMembers(allowed);
  const mutationGuard = useClinicalMutationGuard();
  const organizationId = useActiveOrganizationId();
  const [form, setForm] = useState<ProcedureFormState>(() => emptyProcedureForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [baseline, setBaseline] = useState('');
  const initializedRef = useRef(false);
  const timezone = organization.data?.timezone ?? 'UTC';
  const item: ClinicalProcedureDetail | null = procedure.data;

  // Tenant changes discard all unsaved form state and identifiers before another organization can render.
  useEffect(() => {
    setForm(emptyProcedureForm());
    setError(null);
    setBaseline('');
    setLoadedId(null);
    setSaving(false);
    initializedRef.current = false;
  }, [organizationId]);

  useEffect(() => {
    if (!organization.loading && mode === 'edit' && item && item.id !== loadedId) {
      if (patientId && item.patientId !== patientId) return;
      const values = procedureFormFromDetail(item, timezone);
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
      ) {
        event.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [baseline, form, mode]);

  const currentEncounter = encounter.data;
  const canEdit =
    allowed &&
    (mode === 'create'
      ? Boolean(
          currentEncounter &&
          currentEncounter.status !== 'VOIDED' &&
          currentEncounter.patient.status !== 'ARCHIVED',
        )
      : Boolean(
          item?.status === 'DRAFT' &&
          item.parentEncounterStatus !== 'VOIDED' &&
          item.patient.status !== 'ARCHIVED',
        ));
  const practitionerOptions = useMemo(
    () => (members.data?.data ?? []).filter((member) => member.clinicalRole === 'PRACTITIONER'),
    [members.data],
  );
  const clinicalAssistantOptions = useMemo(() => members.data?.data ?? [], [members.data]);
  const hasSurgeryDraftData = Boolean(
    form.assistantId ||
    form.surgicalArea.trim() ||
    form.surgicalSide.trim() ||
    form.bleedingNotes.trim() ||
    form.closureNotes.trim(),
  );

  function update<K extends keyof ProcedureFormState>(key: K, value: ProcedureFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  // Explicit stale recovery discards the local draft only after the user asks to load server state.
  async function reloadCurrentDraft() {
    if (!procedureId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const current = await proceduresApi.findById(procedureId, mutationGuard.signal());
      if (!mutationGuard.isCurrent()) return;
      if (current.patientId !== patientId || current.status !== 'DRAFT') {
        procedure.reload();
        return;
      }
      const values = procedureFormFromDetail(current, timezone);
      setForm(values);
      setBaseline(JSON.stringify(values));
      setLoadedId(current.id);
      procedure.reload();
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
    const timestampError = validateProcedureTimestamp(form, timezone);
    if (timestampError) {
      setError(new Error(timestampError));
      return;
    }
    const payload = procedurePayload(form, timezone);
    setSaving(true);
    setError(null);
    try {
      const saved =
        mode === 'create'
          ? await proceduresApi.create(encounterId!, payload, mutationGuard.signal())
          : await proceduresApi.updateDraft(
              procedureId!,
              { ...payload, expectedVersion: item!.version },
              mutationGuard.signal(),
            );
      if (mutationGuard.isCurrent())
        navigate(`/pacientes/${patientId}/historia/procedimientos/${saved.id}`, {
          replace: mode === 'create',
        });
    } catch (nextError) {
      if (mutationGuard.isCurrent()) setError(nextError);
    } finally {
      if (mutationGuard.isCurrent()) setSaving(false);
    }
  }

  if (!patientId || (mode === 'create' && !encounterId) || (mode === 'edit' && !procedureId))
    return (
      <ResourceError error={new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')} />
    );
  if (!allowed)
    return (
      <ResourceError error={new ApiError('No tienes permiso para editar este borrador.', 403)} />
    );
  if (
    organization.loading ||
    (mode === 'create' && canReadEncounter && encounter.loading) ||
    (mode === 'edit' && procedure.loading) ||
    members.loading
  )
    return <LoadingState label="Cargando datos del procedimiento" />;
  if (organization.error)
    return <ResourceError error={organization.error} onRetry={organization.reload} />;
  if (members.error) return <ResourceError error={members.error} onRetry={members.reload} />;
  if (mode === 'create' && (!currentEncounter || currentEncounter.patientId !== patientId))
    return (
      <ResourceError
        error={encounter.error ?? new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')}
        onRetry={encounter.reload}
      />
    );
  if (
    mode === 'edit' &&
    (procedure.error ||
      !item ||
      (loadedId && item.id !== loadedId) ||
      (patientId && item.patientId !== patientId))
  )
    return (
      <ResourceError
        error={procedure.error ?? new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')}
        onRetry={procedure.reload}
      />
    );
  if (!canEdit)
    return (
      <ResourceError
        error={
          new ApiError(
            'Este registro no se puede editar. Solo los borradores asociados a una consulta y paciente activos admiten cambios.',
            409,
          )
        }
      />
    );

  return (
    <div className="page-stack clinical-page clinical-domain-page">
      <PageHeader
        eyebrow={mode === 'create' ? 'Nuevo procedimiento' : 'Editar borrador'}
        title={form.kind === 'SURGERY' ? 'Registrar cirugía' : 'Registrar procedimiento'}
        description={`Las fechas se interpretan en la zona horaria de la organización (${timezone}). El guardado conserva el registro como borrador.`}
        action={
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              if (window.confirm('¿Descartar cambios y volver al encuentro?')) navigate(-1);
            }}
          >
            Volver
          </Button>
        }
      />
      {error ? (
        <Alert tone="error" role="alert">
          {error instanceof ApiError && error.code === 'PROCEDURE_STALE' ? (
            <>
              Este borrador cambió en otra sesión. Tus datos siguen aquí;{' '}
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
            <FormField label="Tipo de registro *" htmlFor="procedure-kind">
              <select
                id="procedure-kind"
                className="input"
                value={form.kind}
                disabled={saving}
                onChange={(event) => {
                  const next = event.target.value as ProcedureFormState['kind'];
                  if (
                    form.kind === 'SURGERY' &&
                    next === 'PROCEDURE' &&
                    hasSurgeryDraftData &&
                    !window.confirm(
                      'Al cambiar a Procedimiento se eliminarán los datos específicos de cirugía del borrador. ¿Continuar?',
                    )
                  )
                    return;
                  update('kind', next);
                  if (next === 'PROCEDURE')
                    setForm((current) => ({
                      ...current,
                      kind: next,
                      assistantId: '',
                      surgicalArea: '',
                      surgicalSide: '',
                      bleedingNotes: '',
                      closureNotes: '',
                    }));
                }}
              >
                <option value="PROCEDURE">Procedimiento</option>
                <option value="SURGERY">Cirugía</option>
              </select>
            </FormField>
            <FormField label="Fecha realizada" htmlFor="procedure-date">
              <TextInput
                id="procedure-date"
                type="date"
                value={form.performedDate}
                disabled={saving}
                onChange={(event) => update('performedDate', event.target.value)}
              />
            </FormField>
            <FormField label="Hora realizada" htmlFor="procedure-time">
              <TextInput
                id="procedure-time"
                type="time"
                value={form.performedTime}
                disabled={saving}
                onChange={(event) => update('performedTime', event.target.value)}
              />
            </FormField>
            <FormField label="Profesional responsable" htmlFor="procedure-responsible">
              <select
                id="procedure-responsible"
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
          </div>
          {PROCEDURE_TEXT_FIELDS.map(([key, label, maxLength]) => (
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
        </Card>
        {form.kind === 'SURGERY' ? (
          <Card>
            <div className="detail-card__heading">
              <div>
                <p className="section-kicker">Detalle específico</p>
                <h2>Cirugía</h2>
              </div>
            </div>
            <div className="clinical-domain-form__grid">
              <FormField label="Asistente clínico" htmlFor="procedure-assistant">
                <select
                  id="procedure-assistant"
                  className="input"
                  value={form.assistantId}
                  disabled={saving}
                  onChange={(event) => update('assistantId', event.target.value)}
                >
                  <option value="">Sin asignar</option>
                  {clinicalAssistantOptions.map((member) => (
                    <option key={member.membershipId} value={member.membershipId}>
                      {member.displayName || 'Miembro sin perfil'} ·{' '}
                      {member.clinicalRole === 'PRACTITIONER' ? 'Profesional' : 'Asistente'}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Área quirúrgica" htmlFor="procedure-area">
                <TextInput
                  id="procedure-area"
                  value={form.surgicalArea}
                  maxLength={500}
                  disabled={saving}
                  onChange={(event) => update('surgicalArea', event.target.value)}
                />
              </FormField>
              <FormField label="Lado" htmlFor="procedure-side">
                <TextInput
                  id="procedure-side"
                  value={form.surgicalSide}
                  maxLength={200}
                  disabled={saving}
                  onChange={(event) => update('surgicalSide', event.target.value)}
                />
              </FormField>
            </div>
            <TextArea
              field="bleedingNotes"
              label="Sangrado"
              value={form.bleedingNotes}
              maxLength={5000}
              disabled={saving}
              onChange={(value) => update('bleedingNotes', value)}
            />
            <TextArea
              field="closureNotes"
              label="Cierre"
              value={form.closureNotes}
              maxLength={5000}
              disabled={saving}
              onChange={(value) => update('closureNotes', value)}
            />
            {form.assistantId &&
            clinicalAssistantOptions.find((member) => member.membershipId === form.assistantId)
              ?.profileConfigured === false ? (
              <Alert tone="warning" role="status">
                El asistente asignado debe completar su perfil profesional antes de finalizar.
              </Alert>
            ) : null}
          </Card>
        ) : null}
        <div className="modal-actions">
          <Button
            variant="secondary"
            type="button"
            disabled={saving}
            onClick={() => {
              if (window.confirm('¿Descartar cambios y volver al encuentro?')) navigate(-1);
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
