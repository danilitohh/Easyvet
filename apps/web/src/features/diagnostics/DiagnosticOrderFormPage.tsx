import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { DiagnosticCategory } from '@veterinary-saas/contracts';
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
import { instantFromCivil } from '../agenda/agendaUtils';
import {
  useClinicalEncounter,
  useClinicalOrganization,
  useClinicalPractitioners,
} from '../clinical/useClinical';
import { errorMessage } from '../shared/resourceUtils';
import { ResourceError } from '../shared/ResourceFeedback';
import { useActiveOrganizationId } from '../shared/hooks';
import {
  useClinicalMutationGuard,
  useDiagnosticOrderResource,
} from '../shared/useClinicalDomainResource';
import { diagnosticsApi } from './diagnosticsApi';
import { DIAGNOSTIC_CATEGORY_LABEL, localDateTimeFromInstant } from './diagnosticUtils';

type FormValues = {
  category: DiagnosticCategory;
  testName: string;
  requestedAt: string;
  reason: string;
  instructions: string;
  notes: string;
  responsiblePractitionerMembershipId: string;
};

const blankValues: FormValues = {
  category: 'LABORATORY',
  testName: '',
  requestedAt: '',
  reason: '',
  instructions: '',
  notes: '',
  responsiblePractitionerMembershipId: '',
};

// Creates and edits only DRAFT order fields; request/result data has separate lifecycle actions.
export function DiagnosticOrderFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const {
    patientId = '',
    encounterId,
    diagnosticOrderId,
  } = useParams<{
    patientId: string;
    encounterId?: string;
    diagnosticOrderId?: string;
  }>();
  const navigate = useNavigate();
  const canCreate = useCan(PERMISSION.DIAGNOSTICS_CREATE);
  const canUpdate = useCan(PERMISSION.DIAGNOSTICS_UPDATE_DRAFT);
  const { activeMembership } = useAuth();
  const organizationId = useActiveOrganizationId();
  const organization = useClinicalOrganization();
  const timezone = organization.data?.timezone ?? 'UTC';
  const encounter = useClinicalEncounter(encounterId, mode === 'create');
  const resource = useDiagnosticOrderResource(diagnosticOrderId, mode === 'edit' && canUpdate);
  const practitioners = useClinicalPractitioners(
    mode === 'create' || resource.data?.status === 'DRAFT',
  );
  const guard = useClinicalMutationGuard();
  const [values, setValues] = useState<FormValues>(blankValues);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const archived =
    mode === 'create'
      ? encounter.data?.patient.status === 'ARCHIVED'
      : resource.data?.patient.status === 'ARCHIVED';
  const parentVoided =
    mode === 'create'
      ? encounter.data?.status === 'VOIDED'
      : resource.data?.parentEncounterStatus === 'VOIDED';
  const readOnly =
    mode === 'create'
      ? !canCreate || Boolean(archived || parentVoided)
      : !canUpdate ||
        !resource.data ||
        resource.data.status !== 'DRAFT' ||
        Boolean(archived || parentVoided);

  useEffect(() => {
    setValues(blankValues);
    setDirty(false);
    setError(null);
  }, [organizationId]);

  useEffect(() => {
    if (mode === 'edit' && resource.data && !dirty) {
      setValues({
        category: resource.data.category,
        testName: resource.data.testName ?? '',
        requestedAt: localDateTimeFromInstant(resource.data.requestedAt, timezone),
        reason: resource.data.reason ?? '',
        instructions: resource.data.instructions ?? '',
        notes: resource.data.notes ?? '',
        responsiblePractitionerMembershipId:
          resource.data.responsiblePractitionerMembershipId ?? '',
      });
    }
  }, [dirty, mode, resource.data, timezone]);

  // Prefill the assigned Practitioner once while the clean create form is still untouched.
  useEffect(() => {
    if (
      mode === 'create' &&
      !dirty &&
      activeMembership?.clinicalRole === 'PRACTITIONER' &&
      practitioners.data?.data.some((item) => item.membershipId === activeMembership.id)
    ) {
      setValues((current) =>
        current.responsiblePractitionerMembershipId === activeMembership.id
          ? current
          : { ...current, responsiblePractitionerMembershipId: activeMembership.id },
      );
    }
  }, [activeMembership, dirty, mode, practitioners.data]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly || saving) return;
    setSaving(true);
    setError(null);
    try {
      const requestedAt = values.requestedAt
        ? instantFromCivil(
            values.requestedAt.split('T')[0] ?? '',
            values.requestedAt.split('T')[1] ?? '',
            timezone,
          )
        : null;
      const common = {
        testName: values.testName.trim() || null,
        requestedAt,
        reason: values.reason.trim() || null,
        instructions: values.instructions.trim() || null,
        notes: values.notes.trim() || null,
        responsiblePractitionerMembershipId: values.responsiblePractitionerMembershipId || null,
      };
      const detail =
        mode === 'create'
          ? await diagnosticsApi.create(
              encounterId!,
              { ...common, category: values.category },
              guard.signal(),
            )
          : await diagnosticsApi.updateDraft(
              diagnosticOrderId!,
              { ...common, category: values.category, expectedVersion: resource.data!.version },
              guard.signal(),
            );
      if (!guard.isCurrent()) return;
      navigate(`/pacientes/${patientId}/historia/diagnosticos/${detail.id}`, { replace: true });
    } catch (requestError) {
      if (guard.isCurrent()) setError(requestError);
    } finally {
      if (guard.isCurrent()) setSaving(false);
    }
  }

  if (mode === 'create' && encounter.loading)
    return (
      <Card>
        <LoadingState label="Validando encuentro clínico" />
      </Card>
    );
  if (mode === 'create' && encounter.error)
    return (
      <Card>
        <ResourceError error={encounter.error} onRetry={encounter.reload} />
      </Card>
    );
  if (mode === 'create' && encounter.data && encounter.data.patientId !== patientId) {
    return (
      <ResourceError error={new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')} />
    );
  }
  if (mode === 'edit' && resource.loading)
    return (
      <Card>
        <LoadingState label="Cargando borrador diagnóstico" />
      </Card>
    );
  if (mode === 'edit' && resource.error)
    return (
      <Card>
        <ResourceError error={resource.error} onRetry={resource.reload} />
      </Card>
    );
  if (mode === 'edit' && !resource.data)
    return <ResourceError error={new Error('Orden diagnóstica no encontrada.')} />;
  if (mode === 'edit' && resource.data && resource.data.patientId !== patientId) {
    return (
      <ResourceError error={new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')} />
    );
  }

  const backTo = `/pacientes/${patientId}/historia/diagnosticos${mode === 'edit' ? `/${diagnosticOrderId}` : ''}`;
  const updateField = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setDirty(true);
    setValues((current) => ({ ...current, [key]: value }));
  };

  return (
    <section className="page-stack clinical-page clinical-domain-page">
      <PageHeader
        eyebrow="Historia clínica · Diagnósticos"
        title={mode === 'create' ? 'Nuevo examen' : 'Editar borrador'}
        description="Completa o guarda el borrador. La solicitud se emitirá desde el detalle."
        action={
          <Link className="button button--secondary" to={backTo}>
            Volver al detalle
          </Link>
        }
      />
      {archived || parentVoided ? (
        <Alert tone="warning" role="status">
          {archived
            ? 'El paciente está archivado; la orden se conserva en lectura.'
            : 'El encuentro fue anulado; las órdenes Draft o Requested ya no admiten cambios.'}
        </Alert>
      ) : null}
      {readOnly && !archived && !parentVoided ? (
        <Alert tone="warning" role="status">
          Este registro ya no está en estado Draft y no se puede editar.
        </Alert>
      ) : null}
      <Card>
        <form className="page-stack" onSubmit={(event) => void submit(event)}>
          {error ? (
            <Alert tone="error" role="alert">
              {error instanceof ApiError && error.code === 'DIAGNOSTIC_ORDER_STALE'
                ? 'El borrador cambió en otra sesión. Tus datos siguen en el formulario; recarga explícitamente para ver la versión actual.'
                : errorMessage(error, 'No fue posible guardar el borrador.')}
              {error instanceof ApiError && error.status === 409 ? (
                <Button type="button" variant="secondary" onClick={resource.reload}>
                  Recargar borrador
                </Button>
              ) : null}
            </Alert>
          ) : null}
          <div className="form-grid form-grid--two">
            <FormField label="Categoría" htmlFor="diagnostic-category">
              <select
                id="diagnostic-category"
                className="input"
                value={values.category}
                disabled={readOnly || saving}
                onChange={(event) =>
                  updateField('category', event.target.value as DiagnosticCategory)
                }
              >
                {Object.entries(DIAGNOSTIC_CATEGORY_LABEL).map(([category, label]) => (
                  <option key={category} value={category}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Nombre del examen" htmlFor="diagnostic-test-name">
              <TextInput
                id="diagnostic-test-name"
                maxLength={300}
                value={values.testName}
                disabled={readOnly || saving}
                onChange={(event) => updateField('testName', event.target.value)}
              />
            </FormField>
            <FormField
              label="Fecha solicitada"
              htmlFor="diagnostic-requested-at"
              hint={`Zona horaria: ${timezone}`}
            >
              <TextInput
                id="diagnostic-requested-at"
                type="datetime-local"
                value={values.requestedAt}
                disabled={readOnly || saving}
                onChange={(event) => updateField('requestedAt', event.target.value)}
              />
            </FormField>
            <FormField label="Profesional responsable" htmlFor="diagnostic-responsible">
              <select
                id="diagnostic-responsible"
                className="input"
                value={values.responsiblePractitionerMembershipId}
                disabled={readOnly || saving || practitioners.loading}
                onChange={(event) =>
                  updateField('responsiblePractitionerMembershipId', event.target.value)
                }
              >
                <option value="">Sin asignar</option>
                {practitioners.data?.data
                  .filter((member) => member.displayName?.trim())
                  .map((member) => (
                    <option key={member.membershipId} value={member.membershipId}>
                      {member.displayName}
                      {member.membershipId === activeMembership?.id ? ' · tú' : ''}
                    </option>
                  ))}
              </select>
            </FormField>
          </div>
          <FormField label="Motivo" htmlFor="diagnostic-reason">
            <textarea
              id="diagnostic-reason"
              className="input textarea"
              maxLength={5000}
              value={values.reason}
              disabled={readOnly || saving}
              onChange={(event) => updateField('reason', event.target.value)}
            />
          </FormField>
          <FormField label="Instrucciones" htmlFor="diagnostic-instructions">
            <textarea
              id="diagnostic-instructions"
              className="input textarea"
              maxLength={10000}
              value={values.instructions}
              disabled={readOnly || saving}
              onChange={(event) => updateField('instructions', event.target.value)}
            />
          </FormField>
          <FormField label="Notas" htmlFor="diagnostic-notes">
            <textarea
              id="diagnostic-notes"
              className="input textarea"
              maxLength={10000}
              value={values.notes}
              disabled={readOnly || saving}
              onChange={(event) => updateField('notes', event.target.value)}
            />
          </FormField>
          {practitioners.error ? (
            <ResourceError error={practitioners.error} onRetry={practitioners.reload} />
          ) : null}
          <div className="page-header__actions">
            <Button type="submit" disabled={readOnly || saving}>
              {saving ? 'Guardando…' : 'Guardar borrador'}
            </Button>
            <Button as={Link} to={backTo} variant="secondary">
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}
