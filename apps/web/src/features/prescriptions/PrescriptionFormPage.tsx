import {
  createPrescriptionRequestSchema,
  updatePrescriptionRequestSchema,
} from '@veterinary-saas/contracts';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { useAuth } from '../../contexts/useAuth';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { ApiError } from '../../services/apiClient';
import { ResourceError } from '../shared/ResourceFeedback';
import { errorMessage } from '../shared/resourceUtils';
import { usePatient } from '../patients/usePatients';
import {
  useClinicalEncounter,
  useClinicalOrganization,
  useClinicalPractitioners,
} from '../clinical/useClinical';
import { formatDateTime, ENCOUNTER_STATUS_LABEL } from '../clinical/clinicalUtils';
import { prescriptionsApi } from './prescriptionsApi';
import { usePrescription } from './usePrescriptions';
import { PrescriptionItemsEditor } from './PrescriptionItemsEditor';
import {
  editorFromPrescription,
  itemValidationErrors,
  normalizedItems,
  sameEditorState,
  type PrescriptionEditorState,
} from './prescriptionEditorUtils';

type PrescriptionFormPageProps = { mode: 'create' | 'edit' };

const EMPTY_EDITOR: PrescriptionEditorState = {
  prescribedByMembershipId: '',
  items: [],
  version: null,
};

function detailPath(patientId: string, prescriptionId: string) {
  return `/pacientes/${patientId}/historia/prescripciones/${prescriptionId}`;
}

function practitionerLabel(displayName: string | null, profileConfigured: boolean) {
  return `${displayName?.trim() || 'Profesional sin perfil'}${profileConfigured ? '' : ' · Perfil incompleto'}`;
}

function staleError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'PRESCRIPTION_STALE';
}

// Create and edit share one aggregate form so every save sends the complete item set atomically.
export function PrescriptionFormPage({ mode }: PrescriptionFormPageProps) {
  const { patientId, encounterId, prescriptionId } = useParams<{
    patientId: string;
    encounterId: string;
    prescriptionId: string;
  }>();
  const navigate = useNavigate();
  const { activeMembership } = useAuth();
  const organizationId = activeMembership?.organization.id;
  const canCreate = useCan(PERMISSION.PRESCRIPTIONS_CREATE);
  const canUpdate = useCan(PERMISSION.PRESCRIPTIONS_UPDATE_DRAFT);
  const canReadEncounter = useCan(PERMISSION.CLINICAL_ENCOUNTERS_READ);
  const canManage = mode === 'create' ? canCreate : canUpdate;
  const organization = useClinicalOrganization();
  const patient = usePatient(patientId);
  const prescription = usePrescription(prescriptionId, mode === 'edit' && canManage);
  // Edit routes resolve the parent encounter from the prescription because the URL only needs
  // the patient and prescription identifiers; create routes keep the explicit encounter context.
  const resolvedEncounterId = encounterId ?? prescription.data?.clinicalEncounterId;
  const encounter = useClinicalEncounter(resolvedEncounterId, canReadEncounter && canManage);
  const practitioners = useClinicalPractitioners(canManage);
  const [form, setForm] = useState<PrescriptionEditorState>(EMPTY_EDITOR);
  const [initialForm, setInitialForm] = useState<PrescriptionEditorState>(EMPTY_EDITOR);
  const [initialized, setInitialized] = useState(false);
  const [reloadRequested, setReloadRequested] = useState(false);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [serverError, setServerError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const mutationRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setInitialized(false);
    setReloadRequested(false);
    setForm(EMPTY_EDITOR);
    setInitialForm(EMPTY_EDITOR);
    setErrors({});
    setServerError(null);
    mutationRef.current?.abort();
  }, [organizationId, patientId, encounterId, prescriptionId, mode]);

  useEffect(() => {
    if (
      mode === 'create' &&
      !initialized &&
      organization.data &&
      encounter.data &&
      patient.patient
    ) {
      const next: PrescriptionEditorState = {
        prescribedByMembershipId:
          activeMembership?.clinicalRole === 'PRACTITIONER' ? activeMembership.id : '',
        items: [],
        version: null,
      };
      setForm(next);
      setInitialForm(next);
      setInitialized(true);
    }
  }, [activeMembership, encounter.data, initialized, mode, organization.data, patient.patient]);

  useEffect(() => {
    if (
      mode === 'edit' &&
      prescription.data &&
      (!initialized || (reloadRequested && !prescription.loading))
    ) {
      const next = editorFromPrescription(prescription.data);
      setForm(next);
      setInitialForm(next);
      setErrors({});
      setServerError(null);
      setInitialized(true);
      setReloadRequested(false);
    }
  }, [initialized, mode, prescription.data, prescription.loading, reloadRequested]);

  useEffect(() => () => mutationRef.current?.abort(), [organizationId]);

  const dirty = initialized && !sameEditorState(form, initialForm);
  const selectedPractitioner = useMemo(
    () =>
      (practitioners.data?.data ?? []).find(
        (practitioner) => practitioner.membershipId === form.prescribedByMembershipId,
      ),
    [form.prescribedByMembershipId, practitioners.data],
  );
  const loading =
    organization.loading ||
    patient.loading ||
    encounter.loading ||
    practitioners.loading ||
    (mode === 'edit' && prescription.loading);

  if (!canManage) return <ResourceError error={new ApiError('Acceso denegado', 403)} />;
  if (!patientId || (mode === 'create' && !encounterId) || (mode === 'edit' && !prescriptionId)) {
    return (
      <ResourceError error={new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')} />
    );
  }
  if (!canReadEncounter) return <ResourceError error={new ApiError('Acceso denegado', 403)} />;
  if (loading) {
    return (
      <div className="page-stack clinical-page">
        <LoadingState label={mode === 'create' ? 'Preparando prescripción' : 'Cargando borrador'} />
      </div>
    );
  }
  if (organization.error)
    return <ResourceError error={organization.error} onRetry={organization.reload} />;
  if (patient.error) return <ResourceError error={patient.error} onRetry={patient.reload} />;
  if (encounter.error) return <ResourceError error={encounter.error} onRetry={encounter.reload} />;
  if (practitioners.error) {
    return <ResourceError error={practitioners.error} onRetry={practitioners.reload} />;
  }
  if (mode === 'edit' && prescription.error) {
    return <ResourceError error={prescription.error} onRetry={prescription.reload} />;
  }
  if (!patient.patient || !encounter.data || encounter.data.patientId !== patientId) {
    return (
      <ResourceError error={new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')} />
    );
  }
  if (mode === 'edit' && (!prescription.data || prescription.data.patientId !== patientId)) {
    return (
      <ResourceError error={new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')} />
    );
  }

  const parent = encounter.data;
  const currentPrescription = prescription.data;
  const parentVoided =
    parent.status === 'VOIDED' || currentPrescription?.parentEncounterStatus === 'VOIDED';
  const invalidParent = parent.status !== 'DRAFT' && parent.status !== 'FINALIZED';
  const immutable = mode === 'edit' && currentPrescription?.status !== 'DRAFT';

  function goBack() {
    const target =
      mode === 'create'
        ? `/pacientes/${patientId}/historia/encuentros/${encounterId}`
        : detailPath(patientId!, prescriptionId!);
    if (!dirty || window.confirm('Hay cambios sin guardar. ¿Deseas salir?')) navigate(target);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !organization.data || !initialized) return;
    const validation = itemValidationErrors(form.items);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    const items = normalizedItems(form.items);
    const controller = new AbortController();
    mutationRef.current?.abort();
    mutationRef.current = controller;
    setSaving(true);
    setServerError(null);
    try {
      const saved =
        mode === 'create'
          ? await prescriptionsApi.create(
              encounterId!,
              createPrescriptionRequestSchema.parse({
                prescribedByMembershipId: form.prescribedByMembershipId || null,
                items,
              }),
              controller.signal,
            )
          : await prescriptionsApi.updateDraft(
              prescriptionId!,
              updatePrescriptionRequestSchema.parse({
                expectedVersion: form.version,
                prescribedByMembershipId: form.prescribedByMembershipId || null,
                items,
              }),
              controller.signal,
            );
      if (controller.signal.aborted) return;
      navigate(detailPath(patientId!, saved.id));
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      if (staleError(error)) {
        setServerError(error);
      } else if (error instanceof ApiError && error.code === 'PARENT_CLINICAL_ENCOUNTER_VOIDED') {
        const target =
          mode === 'edit' && prescriptionId
            ? detailPath(patientId!, prescriptionId)
            : `/pacientes/${patientId}/historia/encuentros/${encounterId}`;
        if (mode === 'edit') prescription.reload();
        navigate(target, {
          replace: true,
          state: {
            notice:
              mode === 'edit'
                ? 'La consulta asociada fue anulada. El borrador conserva su historial.'
                : 'La consulta asociada fue anulada. No se pudo guardar la prescripción.',
          },
        });
      } else {
        setServerError(error);
      }
    } finally {
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  if (parentVoided || invalidParent) {
    return (
      <div className="page-stack clinical-page prescription-page">
        <PageHeader
          eyebrow="Historia clínica · Prescripción"
          title={mode === 'create' ? 'Nueva prescripción' : 'Editar prescripción'}
          description={`${patient.patient.name} · ${ENCOUNTER_STATUS_LABEL[parent.status]}`}
          action={
            <Button type="button" variant="secondary" onClick={goBack}>
              Volver
            </Button>
          }
        />
        <Card className="resource-feedback-card">
          <Alert tone="warning" role="status">
            La consulta asociada fue anulada. No puedes crear ni editar una prescripción desde este
            contexto.
          </Alert>
          {mode === 'edit' ? (
            <Button as={Link} to={detailPath(patientId, prescriptionId!)} variant="secondary">
              Ver prescripción
            </Button>
          ) : null}
        </Card>
      </div>
    );
  }

  if (immutable) {
    return (
      <div className="page-stack clinical-page prescription-page">
        <PageHeader
          eyebrow="Historia clínica · Prescripción"
          title="Prescripción no editable"
          description="Solo los borradores pueden modificarse."
        />
        <Card className="resource-feedback-card">
          <Alert tone="info" role="status">
            Esta prescripción ya no está en borrador y conserva su contenido histórico.
          </Alert>
          <Button as={Link} to={detailPath(patientId, prescriptionId!)} variant="secondary">
            Ver prescripción
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-stack clinical-page prescription-page">
      <PageHeader
        eyebrow="Historia clínica · Prescripción"
        title={mode === 'create' ? 'Nueva prescripción' : 'Editar borrador'}
        description={`${patient.patient.name} · ${parent.reason} · ${formatDateTime(parent.occurredAt, organization.data?.timezone ?? 'UTC')}`}
        action={
          <Button type="button" variant="secondary" onClick={goBack}>
            Cancelar
          </Button>
        }
      />
      {serverError ? (
        <Alert tone="error" role="alert">
          {staleError(serverError)
            ? 'Esta prescripción fue modificada desde otra sesión.'
            : errorMessage(serverError, 'No fue posible guardar el borrador.')}
          {staleError(serverError) ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setReloadRequested(true);
                setServerError(null);
                prescription.reload();
              }}
            >
              Recargar versión actual
            </Button>
          ) : null}
        </Alert>
      ) : null}
      <Card className="form-card prescription-form-card">
        <form className="domain-form" onSubmit={(event) => void submit(event)} noValidate>
          <div className="prescription-form-context">
            <div>
              <p className="section-kicker">Contexto clínico</p>
              <h2>{parent.reason}</h2>
              <p>
                {formatDateTime(parent.occurredAt, organization.data?.timezone ?? 'UTC')} ·{' '}
                {patient.patient.name}
              </p>
            </div>
            <Badge tone="neutral">Borrador</Badge>
          </div>
          <FormField
            label="Profesional prescriptor"
            htmlFor="prescription-prescriber"
            hint="Puede quedar sin asignar mientras preparas el borrador."
          >
            <Select
              id="prescription-prescriber"
              value={form.prescribedByMembershipId}
              disabled={saving}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  prescribedByMembershipId: event.target.value,
                }))
              }
            >
              <option value="">Sin prescriptor asignado</option>
              {(practitioners.data?.data ?? []).map((practitioner) => (
                <option key={practitioner.membershipId} value={practitioner.membershipId}>
                  {practitionerLabel(practitioner.displayName, practitioner.profileConfigured)}
                </option>
              ))}
            </Select>
          </FormField>
          {selectedPractitioner && !selectedPractitioner.profileConfigured ? (
            <Alert tone="info" role="status">
              Perfil profesional incompleto. Puede seleccionarse para preparar este borrador; la
              finalización quedará bloqueada hasta completarlo.
            </Alert>
          ) : null}
          <div className="form-section">
            <div>
              <p className="section-kicker">Indicaciones</p>
              <h2>Medicamentos e indicaciones</h2>
            </div>
            <p>
              Los campos clínicos son texto libre. Solo el nombre del medicamento es obligatorio.
            </p>
          </div>
          <PrescriptionItemsEditor
            items={form.items}
            errors={errors}
            disabled={saving}
            onChange={(items) => {
              setForm((current) => ({ ...current, items }));
              setErrors({});
              setServerError(null);
            }}
          />
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={goBack} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !initialized}>
              {saving ? 'Guardando…' : 'Guardar borrador'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
