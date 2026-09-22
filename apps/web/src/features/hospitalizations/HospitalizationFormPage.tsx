import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { CreateHospitalizationRequest } from '@veterinary-saas/contracts';
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
import { civilFieldsFromInstant, instantFromCivil } from '../agenda/agendaUtils';
import {
  useClinicalEncounter,
  useClinicalOrganization,
  useClinicalPractitioners,
} from '../clinical/useClinical';
import { errorMessage } from '../shared/resourceUtils';
import { ResourceError } from '../shared/ResourceFeedback';
import {
  useClinicalMutationGuard,
  useHospitalizationResource,
} from '../shared/useClinicalDomainResource';
import { hospitalizationsApi } from './hospitalizationsApi';

type FormValues = {
  admittedAt: string;
  locationName: string;
  admissionReason: string;
  diagnosis: string;
  treatmentPlan: string;
  medicationsText: string;
  dietInstructions: string;
  notes: string;
  responsiblePractitionerMembershipId: string;
};

const blankValues: FormValues = {
  admittedAt: '',
  locationName: '',
  admissionReason: '',
  diagnosis: '',
  treatmentPlan: '',
  medicationsText: '',
  dietInstructions: '',
  notes: '',
  responsiblePractitionerMembershipId: '',
};

function localDateTime(instant: string | null | undefined, timezone: string): string {
  if (!instant) return '';
  const civil = civilFieldsFromInstant(instant, timezone);
  return `${civil.date}T${civil.time}`;
}

// Create and edit use one form, while active episodes expose management fields only.
export function HospitalizationFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const {
    patientId = '',
    encounterId,
    hospitalizationId,
  } = useParams<{
    patientId: string;
    encounterId?: string;
    hospitalizationId?: string;
  }>();
  const navigate = useNavigate();
  const canCreate = useCan(PERMISSION.HOSPITALIZATIONS_CREATE);
  const canUpdate = useCan(PERMISSION.HOSPITALIZATIONS_UPDATE);
  const { activeMembership } = useAuth();
  const organization = useClinicalOrganization();
  const timezone = organization.data?.timezone ?? 'America/Bogota';
  const parentEncounter = useClinicalEncounter(encounterId, mode === 'create');
  const resource = useHospitalizationResource(hospitalizationId, mode === 'edit' && canUpdate);
  const practitioners = useClinicalPractitioners(
    mode === 'create' || resource.data?.status === 'DRAFT',
  );
  const mutationGuard = useClinicalMutationGuard();
  const [values, setValues] = useState<FormValues>(blankValues);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const activeEpisode = resource.data?.status === 'ACTIVE';
  const patientArchived =
    mode === 'create'
      ? parentEncounter.data?.patient.status === 'ARCHIVED'
      : resource.data?.patient.status === 'ARCHIVED';
  const parentEncounterVoided =
    mode === 'create'
      ? parentEncounter.data?.status === 'VOIDED'
      : resource.data?.parentEncounterStatus === 'VOIDED';
  const readOnly =
    mode === 'create'
      ? !canCreate
      : !canUpdate ||
        !resource.data ||
        (resource.data.status !== 'DRAFT' && resource.data.status !== 'ACTIVE') ||
        Boolean(patientArchived || parentEncounterVoided);

  useEffect(() => {
    if (resource.data && !dirty) {
      setValues({
        admittedAt: localDateTime(resource.data.admittedAt, timezone),
        locationName: resource.data.locationName ?? '',
        admissionReason: resource.data.admissionReason ?? '',
        diagnosis: resource.data.diagnosis ?? '',
        treatmentPlan: resource.data.treatmentPlan ?? '',
        medicationsText: resource.data.medicationsText ?? '',
        dietInstructions: resource.data.dietInstructions ?? '',
        notes: resource.data.notes ?? '',
        responsiblePractitionerMembershipId:
          resource.data.responsiblePractitionerMembershipId ?? '',
      });
    }
  }, [dirty, resource.data, timezone]);

  const pageTitle = useMemo(
    () =>
      mode === 'create'
        ? 'Nuevo ingreso'
        : activeEpisode
          ? 'Actualizar plan activo'
          : 'Editar borrador',
    [activeEpisode, mode],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly || saving) return;
    setSaving(true);
    setError(null);
    try {
      const common = {
        locationName: values.locationName.trim() || null,
        admissionReason: values.admissionReason.trim() || null,
        diagnosis: values.diagnosis.trim() || null,
        treatmentPlan: values.treatmentPlan.trim() || null,
        medicationsText: values.medicationsText.trim() || null,
        dietInstructions: values.dietInstructions.trim() || null,
        notes: values.notes.trim() || null,
      };
      const signal = mutationGuard.signal();
      const detail =
        mode === 'create'
          ? await hospitalizationsApi.create(
              encounterId!,
              {
                ...common,
                admittedAt: values.admittedAt
                  ? instantFromCivil(
                      values.admittedAt.split('T')[0] ?? '',
                      values.admittedAt.split('T')[1] ?? '',
                      timezone,
                    )
                  : null,
                responsiblePractitionerMembershipId:
                  values.responsiblePractitionerMembershipId || null,
              } satisfies CreateHospitalizationRequest,
              signal,
            )
          : await hospitalizationsApi.update(
              hospitalizationId!,
              {
                expectedVersion: resource.data!.version,
                ...(activeEpisode
                  ? {}
                  : {
                      admittedAt: values.admittedAt
                        ? instantFromCivil(
                            values.admittedAt.split('T')[0] ?? '',
                            values.admittedAt.split('T')[1] ?? '',
                            timezone,
                          )
                        : null,
                    }),
                ...common,
                ...(activeEpisode
                  ? {}
                  : {
                      responsiblePractitionerMembershipId:
                        values.responsiblePractitionerMembershipId || null,
                    }),
              },
              signal,
            );
      if (!mutationGuard.isCurrent()) return;
      navigate(`/pacientes/${patientId}/historia/hospitalizaciones/${detail.id}`, {
        replace: true,
      });
    } catch (requestError) {
      if (mutationGuard.isCurrent()) setError(requestError);
    } finally {
      if (mutationGuard.isCurrent()) setSaving(false);
    }
  }

  if (mode === 'create' && parentEncounter.loading)
    return (
      <Card>
        <LoadingState label="Validando encuentro clínico" />
      </Card>
    );
  if (mode === 'create' && parentEncounter.error)
    return (
      <Card>
        <ResourceError error={parentEncounter.error} onRetry={parentEncounter.reload} />
      </Card>
    );
  if (mode === 'edit' && resource.loading)
    return (
      <Card>
        <LoadingState label="Cargando hospitalización" />
      </Card>
    );
  if (mode === 'edit' && resource.error)
    return (
      <Card>
        <ResourceError error={resource.error} onRetry={resource.reload} />
      </Card>
    );
  if (mode === 'edit' && !resource.data)
    return (
      <Card>
        <LoadingState label="Preparando formulario" />
      </Card>
    );

  return (
    <section className="page-stack hospitalization-page">
      <PageHeader
        eyebrow="Hospitalización · Gestión"
        title={pageTitle}
        description={
          activeEpisode
            ? 'La identidad del ingreso está congelada; solo puedes ajustar ubicación y plan clínico.'
            : 'Completa el borrador desde el encuentro clínico. El episodio no inicia hasta que el responsable lo active.'
        }
        action={
          <Button
            as={Link}
            to={
              hospitalizationId
                ? `/pacientes/${patientId}/historia/hospitalizaciones/${hospitalizationId}`
                : `/pacientes/${patientId}/historia/encuentros/${encounterId}`
            }
            variant="secondary"
          >
            Cancelar
          </Button>
        }
      />
      {resource.data?.patient.status === 'ARCHIVED' ? (
        <Alert tone="warning" role="status">
          El paciente está archivado. Este episodio solo puede consultarse o anularse de forma
          correctiva.
        </Alert>
      ) : null}
      {parentEncounter.data?.patient.status === 'ARCHIVED' && mode === 'create' ? (
        <Alert tone="warning" role="status">
          El paciente está archivado. No se puede crear un ingreso desde este encuentro.
        </Alert>
      ) : null}
      {parentEncounterVoided ? (
        <Alert tone="warning" role="status">
          El encuentro padre está anulado. Este episodio no admite cambios clínicos.
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="error" role="alert">
          {error instanceof ApiError && error.status === 409
            ? 'El episodio cambió o dejó de admitir esta operación. Recarga para revisar su estado actual.'
            : errorMessage(error, 'No fue posible guardar el episodio.')}
          {error instanceof ApiError && error.status === 409 ? (
            <Button type="button" variant="secondary" onClick={resource.reload}>
              Recargar
            </Button>
          ) : null}
        </Alert>
      ) : null}
      <Card>
        <form className="domain-form" onSubmit={(event) => void submit(event)}>
          <div className="form-grid form-grid--two">
            {!activeEpisode ? (
              <FormField
                label="Fecha y hora de ingreso"
                htmlFor="hospitalization-admitted-at"
                hint={`Zona horaria: ${timezone}`}
              >
                <TextInput
                  id="hospitalization-admitted-at"
                  type="datetime-local"
                  value={values.admittedAt}
                  disabled={readOnly || saving}
                  onChange={(event) => {
                    setDirty(true);
                    setValues({ ...values, admittedAt: event.target.value });
                  }}
                />
              </FormField>
            ) : null}
            <FormField label="Ubicación" htmlFor="hospitalization-location">
              <TextInput
                id="hospitalization-location"
                maxLength={160}
                value={values.locationName}
                disabled={readOnly || saving}
                onChange={(event) => {
                  setDirty(true);
                  setValues({ ...values, locationName: event.target.value });
                }}
              />
            </FormField>
            {!activeEpisode ? (
              <FormField
                label="Practitioner responsable"
                htmlFor="hospitalization-responsible"
                hint="La activación solo la puede realizar este profesional."
              >
                <select
                  id="hospitalization-responsible"
                  className="input"
                  value={values.responsiblePractitionerMembershipId}
                  disabled={readOnly || saving || practitioners.loading}
                  onChange={(event) => {
                    setDirty(true);
                    setValues({
                      ...values,
                      responsiblePractitionerMembershipId: event.target.value,
                    });
                  }}
                >
                  <option value="">Sin asignar</option>
                  {practitioners.data?.data
                    .filter((practitioner) => practitioner.displayName?.trim())
                    .map((practitioner) => (
                      <option key={practitioner.membershipId} value={practitioner.membershipId}>
                        {practitioner.displayName}
                        {practitioner.membershipId === activeMembership?.id ? ' · tú' : ''}
                      </option>
                    ))}
                </select>
              </FormField>
            ) : null}
            <FormField label="Motivo de ingreso" htmlFor="hospitalization-reason">
              <textarea
                id="hospitalization-reason"
                className="input textarea"
                maxLength={5000}
                value={values.admissionReason}
                disabled={readOnly || saving}
                onChange={(event) => {
                  setDirty(true);
                  setValues({ ...values, admissionReason: event.target.value });
                }}
              />
            </FormField>
            <FormField label="Diagnóstico" htmlFor="hospitalization-diagnosis">
              <textarea
                id="hospitalization-diagnosis"
                className="input textarea"
                maxLength={10000}
                value={values.diagnosis}
                disabled={readOnly || saving}
                onChange={(event) => {
                  setDirty(true);
                  setValues({ ...values, diagnosis: event.target.value });
                }}
              />
            </FormField>
            <FormField label="Plan de tratamiento" htmlFor="hospitalization-treatment">
              <textarea
                id="hospitalization-treatment"
                className="input textarea"
                maxLength={10000}
                value={values.treatmentPlan}
                disabled={readOnly || saving}
                onChange={(event) => {
                  setDirty(true);
                  setValues({ ...values, treatmentPlan: event.target.value });
                }}
              />
            </FormField>
            <FormField label="Medicamentos" htmlFor="hospitalization-medications">
              <textarea
                id="hospitalization-medications"
                className="input textarea"
                maxLength={10000}
                value={values.medicationsText}
                disabled={readOnly || saving}
                onChange={(event) => {
                  setDirty(true);
                  setValues({ ...values, medicationsText: event.target.value });
                }}
              />
            </FormField>
            <FormField label="Dieta" htmlFor="hospitalization-diet">
              <textarea
                id="hospitalization-diet"
                className="input textarea"
                maxLength={5000}
                value={values.dietInstructions}
                disabled={readOnly || saving}
                onChange={(event) => {
                  setDirty(true);
                  setValues({ ...values, dietInstructions: event.target.value });
                }}
              />
            </FormField>
            <FormField label="Notas" htmlFor="hospitalization-notes">
              <textarea
                id="hospitalization-notes"
                className="input textarea"
                maxLength={10000}
                value={values.notes}
                disabled={readOnly || saving}
                onChange={(event) => {
                  setDirty(true);
                  setValues({ ...values, notes: event.target.value });
                }}
              />
            </FormField>
          </div>
          <div className="form-actions">
            {!readOnly ? (
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando…' : mode === 'create' ? 'Crear borrador' : 'Guardar cambios'}
              </Button>
            ) : null}
            <Button
              as={Link}
              to={
                hospitalizationId
                  ? `/pacientes/${patientId}/historia/hospitalizaciones/${hospitalizationId}`
                  : `/pacientes/${patientId}/historia/encuentros/${encounterId}`
              }
              variant="secondary"
            >
              Volver
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}
