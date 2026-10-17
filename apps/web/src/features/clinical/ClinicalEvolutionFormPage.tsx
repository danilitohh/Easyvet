import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createClinicalEvolutionRequestSchema } from '@veterinary-saas/contracts';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { TextInput } from '../../components/ui/TextInput';
import { ApiError } from '../../services/apiClient';
import { civilFieldsFromInstant, instantFromCivil } from '../agenda/agendaUtils';
import { usePatient } from '../patients/usePatients';
import { ResourceError } from '../shared/ResourceFeedback';
import { errorMessage } from '../shared/resourceUtils';
import { clinicalApi } from './clinicalApi';
import { useClinicalEncounter, useClinicalOrganization, useClinicalRecord } from './useClinical';

type EvolutionFormState = {
  occurredAt: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

const EMPTY_FORM: EvolutionFormState = {
  occurredAt: '',
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
};

const NARRATIVE_FIELDS: Array<[keyof Omit<EvolutionFormState, 'occurredAt'>, string]> = [
  ['subjective', 'Subjetivo'],
  ['objective', 'Objetivo'],
  ['assessment', 'Valoración'],
  ['plan', 'Plan'],
];

// Evolution form creates append-only clinical notes and never exposes author or tenant IDs.
export function ClinicalEvolutionFormPage() {
  const { patientId, encounterId } = useParams<{ patientId: string; encounterId?: string }>();
  const navigate = useNavigate();
  const organization = useClinicalOrganization();
  const patient = usePatient(patientId);
  const record = useClinicalRecord(patientId, Boolean(patientId));
  const encounter = useClinicalEncounter(encounterId, Boolean(encounterId));
  const [form, setForm] = useState<EvolutionFormState>(EMPTY_FORM);
  const [initialSignature, setInitialSignature] = useState('');
  const [serverError, setServerError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const organizationTimezone = organization.data?.timezone;
  const organizationId = organization.data?.id;

  useEffect(() => {
    if (!organizationTimezone) return;
    const fields = civilFieldsFromInstant(new Date().toISOString(), organizationTimezone);
    const initialForm = { ...EMPTY_FORM, occurredAt: `${fields.date}T${fields.time}` };
    setForm(initialForm);
    setInitialSignature(JSON.stringify(initialForm));
  }, [organizationId, organizationTimezone]);

  const loading =
    organization.loading ||
    patient.loading ||
    record.loading ||
    (Boolean(encounterId) && encounter.loading);
  const formTitle = 'Nueva evolución clínica';
  const formDescription = 'Añade una nota clínica append-only al historial del paciente.';

  if (!patientId) return <ResourceError error={new ApiError('Paciente no encontrado', 404)} />;
  const requiredPatientId = patientId;
  if (loading) {
    return (
      <div className="page-stack clinical-page">
        <PageHeader eyebrow="Historia clínica" title={formTitle} description={formDescription} />
        <LoadingState label="Preparando evolución clínica" />
      </div>
    );
  }
  if (organization.error || patient.error || record.error || encounter.error) {
    const resourceError = organization.error ?? patient.error ?? record.error ?? encounter.error;
    const reload = organization.error
      ? organization.reload
      : patient.error
        ? patient.reload
        : record.error
          ? record.reload
          : encounter.reload;
    return (
      <div className="page-stack clinical-page">
        <PageHeader eyebrow="Historia clínica" title={formTitle} description={formDescription} />
        <ResourceError error={resourceError} onRetry={reload} />
      </div>
    );
  }
  if (!patient.patient)
    return <ResourceError error={new ApiError('Paciente no encontrado', 404)} />;
  if (patient.patient.status !== 'ACTIVE') {
    return (
      <ResourceError error={new ApiError('El paciente está archivado', 409, 'RESOURCE_ARCHIVED')} />
    );
  }
  if (!record.record) {
    return (
      <ResourceError
        error={new ApiError('Historia clínica no encontrada', 404, 'CLINICAL_RECORD_NOT_FOUND')}
      />
    );
  }
  if (encounterId && (!encounter.data || encounter.data.patientId !== patientId)) {
    return (
      <ResourceError error={new ApiError('Encuentro no encontrado', 404, 'RESOURCE_NOT_FOUND')} />
    );
  }
  if (encounterId && encounter.data?.status !== 'FINALIZED') {
    return (
      <Card className="resource-feedback-card">
        <Alert tone="warning" role="status">
          Solo los encuentros finalizados pueden recibir evoluciones relacionadas.
        </Alert>
        <Button as={Link} to={`/pacientes/${patientId}/historia`} variant="secondary">
          Volver a historia
        </Button>
      </Card>
    );
  }

  const dirty = Boolean(initialSignature) && JSON.stringify(form) !== initialSignature;
  const returnPath = encounterId
    ? `/pacientes/${patientId}/historia/encuentros/${encounterId}`
    : `/pacientes/${patientId}/historia`;

  function update(field: keyof EvolutionFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setServerError(null);
  }

  function cancel() {
    if (!dirty || window.confirm('Hay cambios sin guardar. ¿Deseas salir?')) navigate(returnPath);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization.data) return;
    const [date, time] = form.occurredAt.split('T');
    let occurredAt: string;
    try {
      occurredAt = instantFromCivil(date ?? '', time ?? '', organization.data.timezone);
    } catch {
      setServerError(
        new ApiError('La fecha no es válida en la zona horaria de la organización.', 400),
      );
      return;
    }
    const hasNarrative = [form.subjective, form.objective, form.assessment, form.plan].some(
      (value) => value.trim(),
    );
    if (!hasNarrative) {
      setServerError(
        new ApiError('Escribe al menos un contenido clínico antes de continuar.', 400),
      );
      return;
    }
    const parsed = createClinicalEvolutionRequestSchema.safeParse({
      clinicalEncounterId: encounterId ?? null,
      occurredAt,
      subjective: form.subjective.trim() || null,
      objective: form.objective.trim() || null,
      assessment: form.assessment.trim() || null,
      plan: form.plan.trim() || null,
    });
    if (!parsed.success) {
      setServerError(
        new ApiError('Escribe al menos un contenido clínico antes de continuar.', 400),
      );
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      await clinicalApi.createEvolution(requiredPatientId, parsed.data);
      navigate(returnPath);
    } catch (error: unknown) {
      setServerError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack clinical-page">
      <PageHeader
        eyebrow={encounterId ? 'Encuentro finalizado' : 'Historia clínica'}
        title={encounterId ? 'Agregar evolución' : 'Nueva evolución general'}
        description={`${patient.patient.name} · Los registros son append-only.`}
        action={
          <Button variant="secondary" type="button" onClick={cancel}>
            Cancelar
          </Button>
        }
      />
      <Card className="form-card">
        <form className="domain-form" onSubmit={(event) => void submit(event)} noValidate>
          {serverError ? (
            <Alert tone="error" role="alert">
              {errorMessage(serverError, 'No fue posible registrar la evolución.')}
            </Alert>
          ) : null}
          <Alert tone="info" role="status">
            {encounterId
              ? 'Esta evolución quedará vinculada al encuentro finalizado.'
              : 'Esta nota se guardará como evolución general de la historia.'}
          </Alert>
          <FormField
            label="Fecha y hora *"
            htmlFor="evolution-occurred-at"
            hint={`Zona horaria: ${organization.data?.timezone ?? 'organización'}`}
          >
            <TextInput
              id="evolution-occurred-at"
              type="datetime-local"
              value={form.occurredAt}
              onChange={(event) => update('occurredAt', event.target.value)}
              required
            />
          </FormField>
          <div className="form-section">
            <div>
              <p className="section-kicker">Contenido clínico</p>
              <h2>Nota de evolución</h2>
            </div>
            <p>Completa al menos un apartado. El texto conserva sus saltos de línea.</p>
          </div>
          <div className="form-grid form-grid--two">
            {NARRATIVE_FIELDS.map(([field, label]) => (
              <FormField key={field} label={label} htmlFor={`evolution-${field}`}>
                <textarea
                  id={`evolution-${field}`}
                  className="input input--textarea"
                  value={form[field]}
                  maxLength={20_000}
                  onChange={(event) => update(field, event.target.value)}
                />
              </FormField>
            ))}
          </div>
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={cancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Registrando…' : 'Registrar evolución'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
