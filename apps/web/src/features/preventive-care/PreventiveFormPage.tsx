import {
  createDewormingRequestSchema,
  createVaccinationRequestSchema,
  updateDewormingRequestSchema,
  updateVaccinationRequestSchema,
  type DewormingDetail,
  type VaccinationDetail,
} from '@veterinary-saas/contracts';
import { useEffect, useRef, useState, type FormEvent } from 'react';
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
import { TextInput } from '../../components/ui/TextInput';
import { ApiError } from '../../services/apiClient';
import { ResourceError } from '../shared/ResourceFeedback';
import { errorMessage } from '../shared/resourceUtils';
import { usePatient } from '../patients/usePatients';
import {
  useClinicalEncounter,
  useClinicalMembers,
  useClinicalOrganization,
} from '../clinical/useClinical';
import { ENCOUNTER_STATUS_LABEL, formatDateTime } from '../clinical/clinicalUtils';
import { useDeworming } from './useDewormings';
import { dewormingsApi } from './dewormingsApi';
import { useVaccination } from './useVaccinations';
import { vaccinationsApi } from './vaccinationsApi';

export type PreventiveFormKind = 'vaccination' | 'deworming';
type FormValues = Record<string, string | number | null> & { version: number | null };

function field(values: FormValues, key: string): string {
  const value = values[key];
  return typeof value === 'string' ? value : '';
}

const VACCINATION_EMPTY: FormValues = {
  administeredOn: '',
  nextDueOn: '',
  vaccineName: '',
  vaccineType: '',
  route: '',
  laboratoryName: '',
  lotNumber: '',
  expiryOn: '',
  doseText: '',
  notes: '',
  responsiblePractitionerMembershipId: '',
  administeredByMembershipId: '',
  version: null,
};
const DEWORMING_EMPTY: FormValues = {
  administeredOn: '',
  nextDueOn: '',
  productName: '',
  dewormingType: '',
  doseText: '',
  notes: '',
  responsiblePractitionerMembershipId: '',
  administeredByMembershipId: '',
  version: null,
};

function detailPath(kind: PreventiveFormKind, patientId: string, id: string) {
  return `/pacientes/${patientId}/historia/preventivos/${kind === 'vaccination' ? 'vacunas' : 'desparasitaciones'}/${id}`;
}

function practitionerLabel(member: {
  displayName: string | null;
  clinicalRole: string;
  profileConfigured: boolean;
}) {
  const role = member.clinicalRole === 'CLINICAL_ASSISTANT' ? 'Asistente clínico' : 'Practitioner';
  return `${member.displayName?.trim() || 'Profesional sin perfil'} · ${role}${member.profileConfigured ? '' : ' · Perfil profesional incompleto'}`;
}

function staleCode(kind: PreventiveFormKind) {
  return kind === 'vaccination' ? 'VACCINATION_STALE' : 'DEWORMING_STALE';
}

function isStale(error: unknown, kind: PreventiveFormKind) {
  return error instanceof ApiError && error.code === staleCode(kind);
}

function text(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function civil(value: string): string | null {
  return value || null;
}

function valuesFromDetail(
  kind: PreventiveFormKind,
  item: VaccinationDetail | DewormingDetail,
): FormValues {
  if (kind === 'vaccination') {
    const vaccination = item as VaccinationDetail;
    return {
      administeredOn: vaccination.administeredOn ?? '',
      nextDueOn: vaccination.nextDueOn ?? '',
      vaccineName: vaccination.vaccineName ?? '',
      vaccineType: vaccination.vaccineType ?? '',
      route: vaccination.route ?? '',
      laboratoryName: vaccination.laboratoryName ?? '',
      lotNumber: vaccination.lotNumber ?? '',
      expiryOn: vaccination.expiryOn ?? '',
      doseText: vaccination.doseText ?? '',
      notes: vaccination.notes ?? '',
      responsiblePractitionerMembershipId: vaccination.responsiblePractitionerMembershipId ?? '',
      administeredByMembershipId: vaccination.administeredByMembershipId ?? '',
      version: vaccination.version,
    };
  }
  const deworming = item as DewormingDetail;
  return {
    administeredOn: deworming.administeredOn ?? '',
    nextDueOn: deworming.nextDueOn ?? '',
    productName: deworming.productName ?? '',
    dewormingType: deworming.dewormingType ?? '',
    doseText: deworming.doseText ?? '',
    notes: deworming.notes ?? '',
    responsiblePractitionerMembershipId: deworming.responsiblePractitionerMembershipId ?? '',
    administeredByMembershipId: deworming.administeredByMembershipId ?? '',
    version: deworming.version,
  };
}

function FormText({
  id,
  label,
  value,
  onChange,
  maxLength,
  multiline = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  multiline?: boolean;
}) {
  return (
    <FormField label={label} htmlFor={id} hint={`Máximo ${maxLength} caracteres.`}>
      {multiline ? (
        <textarea
          id={id}
          className="input input--textarea"
          value={value}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <TextInput
          id={id}
          value={value}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </FormField>
  );
}

function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FormField label={label} htmlFor={id} hint="Fecha civil; no se convierte por zona horaria.">
      <TextInput
        id={id}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </FormField>
  );
}

function MembersFields({
  values,
  setValue,
  members,
  disabled,
}: {
  values: FormValues;
  setValue: (key: string, value: string) => void;
  members: Array<{
    membershipId: string;
    displayName: string | null;
    clinicalRole: string;
    profileConfigured: boolean;
  }>;
  disabled: boolean;
}) {
  const practitioners = members.filter((member) => member.clinicalRole === 'PRACTITIONER');
  return (
    <div className="form-grid form-grid--two">
      <FormField
        label="Practitioner responsable"
        htmlFor="preventive-responsible"
        hint="Puede quedar sin asignar en el borrador."
      >
        <Select
          id="preventive-responsible"
          value={field(values, 'responsiblePractitionerMembershipId')}
          disabled={disabled}
          onChange={(event) => setValue('responsiblePractitionerMembershipId', event.target.value)}
        >
          <option value="">Sin responsable asignado</option>
          {practitioners.map((member) => (
            <option key={member.membershipId} value={member.membershipId}>
              {practitionerLabel(member)}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField
        label="Administrado por"
        htmlFor="preventive-administered-by"
        hint="Elección explícita; no se preselecciona automáticamente."
      >
        <Select
          id="preventive-administered-by"
          value={field(values, 'administeredByMembershipId')}
          disabled={disabled}
          onChange={(event) => setValue('administeredByMembershipId', event.target.value)}
        >
          <option value="">No especificar</option>
          {members.map((member) => (
            <option key={member.membershipId} value={member.membershipId}>
              {practitionerLabel(member)}
            </option>
          ))}
        </Select>
      </FormField>
    </div>
  );
}

// Contextual preventive form. Vaccination and deworming render separate field sections while
// sharing lifecycle, CAS, tenant-abort, date and membership behavior.
export function PreventiveFormPage({
  kind,
  mode,
}: {
  kind: PreventiveFormKind;
  mode: 'create' | 'edit';
}) {
  const { patientId, encounterId, vaccinationId, dewormingId } = useParams<{
    patientId: string;
    encounterId: string;
    vaccinationId: string;
    dewormingId: string;
  }>();
  const id = kind === 'vaccination' ? vaccinationId : dewormingId;
  const navigate = useNavigate();
  const { activeMembership } = useAuth();
  const organizationId = activeMembership?.organization.id;
  const canManage = useCan(
    mode === 'create'
      ? kind === 'vaccination'
        ? PERMISSION.VACCINATIONS_CREATE
        : PERMISSION.DEWORMINGS_CREATE
      : kind === 'vaccination'
        ? PERMISSION.VACCINATIONS_UPDATE_DRAFT
        : PERMISSION.DEWORMINGS_UPDATE_DRAFT,
  );
  const canReadEncounter = useCan(PERMISSION.CLINICAL_ENCOUNTERS_READ);
  const organization = useClinicalOrganization();
  const patient = usePatient(patientId);
  const vaccination = useVaccination(
    kind === 'vaccination' ? id : undefined,
    mode === 'edit' && canManage,
  );
  const deworming = useDeworming(
    kind === 'deworming' ? id : undefined,
    mode === 'edit' && canManage,
  );
  const current = (kind === 'vaccination' ? vaccination.data : deworming.data) as
    VaccinationDetail | DewormingDetail | null;
  const resolvedEncounterId = encounterId ?? current?.clinicalEncounterId;
  const encounter = useClinicalEncounter(resolvedEncounterId, canReadEncounter && canManage);
  const members = useClinicalMembers(canManage);
  const empty = kind === 'vaccination' ? VACCINATION_EMPTY : DEWORMING_EMPTY;
  const [form, setForm] = useState<FormValues>(empty);
  const [initial, setInitial] = useState<FormValues>(empty);
  const [initialized, setInitialized] = useState(false);
  const [serverError, setServerError] = useState<unknown>(null);
  const [fieldError, setFieldError] = useState('');
  const [saving, setSaving] = useState(false);
  const mutationRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setForm(empty);
    setInitial(empty);
    setInitialized(false);
    setServerError(null);
    setFieldError('');
    mutationRef.current?.abort();
  }, [empty, organizationId, patientId, encounterId, id, kind, mode]);

  useEffect(() => {
    if (
      mode === 'create' &&
      !initialized &&
      organization.data &&
      encounter.data &&
      patient.patient
    ) {
      const next = {
        ...empty,
        responsiblePractitionerMembershipId:
          activeMembership?.clinicalRole === 'PRACTITIONER' ? activeMembership.id : '',
      };
      setForm(next);
      setInitial(next);
      setInitialized(true);
    }
  }, [
    activeMembership,
    encounter.data,
    empty,
    initialized,
    mode,
    organization.data,
    patient.patient,
  ]);

  useEffect(() => {
    if (mode === 'edit' && current && !initialized) {
      const next = valuesFromDetail(kind, current);
      setForm(next);
      setInitial(next);
      setInitialized(true);
    }
  }, [current, initialized, kind, mode]);

  useEffect(() => () => mutationRef.current?.abort(), [organizationId]);

  const dirty = initialized && JSON.stringify(form) !== JSON.stringify(initial);
  const loading =
    organization.loading ||
    patient.loading ||
    encounter.loading ||
    members.loading ||
    (mode === 'edit' && (vaccination.loading || deworming.loading));
  const itemError = kind === 'vaccination' ? vaccination.error : deworming.error;
  const reload = kind === 'vaccination' ? vaccination.reload : deworming.reload;
  const setValue = (key: string, value: string) => {
    setForm((currentValue) => ({ ...currentValue, [key]: value }));
    setServerError(null);
    setFieldError('');
  };

  if (!canManage) return <ResourceError error={new ApiError('Acceso denegado', 403)} />;
  if (!patientId || (mode === 'create' && !encounterId) || (mode === 'edit' && !id))
    return (
      <ResourceError error={new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')} />
    );
  if (loading)
    return (
      <div className="page-stack clinical-page">
        <LoadingState
          label={
            mode === 'create' ? 'Preparando registro preventivo' : 'Cargando borrador preventivo'
          }
        />
      </div>
    );
  if (organization.error)
    return <ResourceError error={organization.error} onRetry={organization.reload} />;
  if (patient.error) return <ResourceError error={patient.error} onRetry={patient.reload} />;
  if (encounter.error) return <ResourceError error={encounter.error} onRetry={encounter.reload} />;
  if (members.error) return <ResourceError error={members.error} onRetry={members.reload} />;
  if (mode === 'edit' && itemError) return <ResourceError error={itemError} onRetry={reload} />;
  if (
    !patient.patient ||
    !encounter.data ||
    encounter.data.patientId !== patientId ||
    (current && current.patientId !== patientId)
  )
    return (
      <ResourceError error={new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')} />
    );

  const parent = encounter.data;
  const parentVoided = parent.status === 'VOIDED' || current?.parentEncounterStatus === 'VOIDED';
  const invalidParent = parent.status !== 'DRAFT' && parent.status !== 'FINALIZED';
  const immutable = mode === 'edit' && current?.status !== 'DRAFT';
  const expiryWarning =
    kind === 'vaccination' &&
    field(form, 'expiryOn') &&
    field(form, 'administeredOn') &&
    field(form, 'expiryOn') < field(form, 'administeredOn');

  function goBack() {
    const target =
      mode === 'create'
        ? `/pacientes/${patientId}/historia/encuentros/${encounterId}`
        : detailPath(kind, patientId!, id!);
    if (!dirty || window.confirm('Hay cambios sin guardar. ¿Deseas salir?')) navigate(target);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !initialized) return;
    if (
      field(form, 'administeredOn') &&
      field(form, 'nextDueOn') &&
      field(form, 'nextDueOn') < field(form, 'administeredOn')
    ) {
      setFieldError('La próxima fecha debe ser igual o posterior a la fecha de aplicación.');
      return;
    }
    const payload =
      kind === 'vaccination'
        ? {
            administeredOn: civil(field(form, 'administeredOn')),
            nextDueOn: civil(field(form, 'nextDueOn')),
            vaccineName: text(field(form, 'vaccineName')),
            vaccineType: text(field(form, 'vaccineType')),
            route: text(field(form, 'route')),
            laboratoryName: text(field(form, 'laboratoryName')),
            lotNumber: text(field(form, 'lotNumber')),
            expiryOn: civil(field(form, 'expiryOn')),
            doseText: text(field(form, 'doseText')),
            notes: text(field(form, 'notes')),
            responsiblePractitionerMembershipId:
              field(form, 'responsiblePractitionerMembershipId') || null,
            administeredByMembershipId: field(form, 'administeredByMembershipId') || null,
          }
        : {
            administeredOn: civil(field(form, 'administeredOn')),
            nextDueOn: civil(field(form, 'nextDueOn')),
            productName: text(field(form, 'productName')),
            dewormingType: text(field(form, 'dewormingType')),
            doseText: text(field(form, 'doseText')),
            notes: text(field(form, 'notes')),
            responsiblePractitionerMembershipId:
              field(form, 'responsiblePractitionerMembershipId') || null,
            administeredByMembershipId: field(form, 'administeredByMembershipId') || null,
          };
    setSaving(true);
    setServerError(null);
    const controller = new AbortController();
    mutationRef.current?.abort();
    mutationRef.current = controller;
    try {
      const saved =
        mode === 'create'
          ? kind === 'vaccination'
            ? await vaccinationsApi.create(
                encounterId!,
                createVaccinationRequestSchema.parse(payload),
                controller.signal,
              )
            : await dewormingsApi.create(
                encounterId!,
                createDewormingRequestSchema.parse(payload),
                controller.signal,
              )
          : kind === 'vaccination'
            ? await vaccinationsApi.updateDraft(
                id!,
                updateVaccinationRequestSchema.parse({ ...payload, expectedVersion: form.version }),
                controller.signal,
              )
            : await dewormingsApi.updateDraft(
                id!,
                updateDewormingRequestSchema.parse({ ...payload, expectedVersion: form.version }),
                controller.signal,
              );
      if (!controller.signal.aborted) navigate(detailPath(kind, patientId!, saved.id));
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      if (isStale(error, kind)) setServerError(error);
      else if (error instanceof ApiError && error.code === 'PARENT_CLINICAL_ENCOUNTER_VOIDED') {
        await Promise.all([encounter.reload(), reload()]);
        setServerError(error);
      } else if (
        error instanceof ApiError &&
        (error.code === 'RESOURCE_ARCHIVED' || error.code === 'PATIENT_ARCHIVED')
      ) {
        await patient.reload();
        setServerError(error);
      } else setServerError(error);
    } finally {
      if (mutationRef.current === controller) {
        mutationRef.current = null;
        setSaving(false);
      }
    }
  }

  if (parentVoided || invalidParent)
    return (
      <div className="page-stack clinical-page preventive-page">
        <PageHeader
          eyebrow="Cuidado preventivo"
          title={mode === 'create' ? 'Nuevo registro preventivo' : 'Editar borrador'}
          description="Contexto no editable"
          action={
            <Button type="button" variant="secondary" onClick={goBack}>
              Volver
            </Button>
          }
        />
        <Card className="resource-feedback-card">
          <Alert tone="warning" role="status">
            La consulta asociada fue anulada. No puedes crear ni editar este registro desde este
            contexto.
          </Alert>
          {current ? (
            <Button as={Link} to={detailPath(kind, patientId!, current.id)} variant="secondary">
              Ver registro
            </Button>
          ) : null}
        </Card>
      </div>
    );
  if (patient.patient.status === 'ARCHIVED' && mode === 'create')
    return (
      <div className="page-stack clinical-page preventive-page">
        <PageHeader
          eyebrow="Cuidado preventivo"
          title="Nuevo registro preventivo"
          description="Paciente archivado"
        />
        <Card className="resource-feedback-card">
          <Alert tone="warning" role="status">
            El paciente está archivado. No puedes crear nuevos registros.
          </Alert>
        </Card>
      </div>
    );
  if (immutable)
    return (
      <div className="page-stack clinical-page preventive-page">
        <PageHeader
          eyebrow="Cuidado preventivo"
          title="Registro no editable"
          description="Solo los borradores pueden modificarse"
        />
        <Card className="resource-feedback-card">
          <Alert tone="info" role="status">
            Solo los borradores pueden modificarse.
          </Alert>
          <Button as={Link} to={detailPath(kind, patientId!, id!)} variant="secondary">
            Ver registro
          </Button>
        </Card>
      </div>
    );

  return (
    <div className="page-stack clinical-page preventive-page">
      <PageHeader
        eyebrow={`Historia clínica · ${kind === 'vaccination' ? 'Vacunación' : 'Desparasitación'}`}
        title={
          mode === 'create'
            ? `Nueva ${kind === 'vaccination' ? 'vacunación' : 'desparasitación'}`
            : 'Editar borrador'
        }
        description={`${patient.patient.name} · ${parent.reason} · ${formatDateTime(parent.occurredAt, organization.data?.timezone ?? 'UTC')}`}
        action={
          <Button type="button" variant="secondary" onClick={goBack}>
            Cancelar
          </Button>
        }
      />
      {serverError ? (
        <Alert tone="error" role="alert">
          {isStale(serverError, kind)
            ? 'Este registro fue modificado desde otra sesión.'
            : errorMessage(serverError, 'No fue posible guardar el borrador.')}
          {isStale(serverError, kind) ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setServerError(null);
                setInitialized(false);
                reload();
              }}
            >
              Recargar versión actual
            </Button>
          ) : null}
        </Alert>
      ) : null}
      {fieldError ? (
        <Alert tone="error" role="alert">
          {fieldError}
        </Alert>
      ) : null}
      {expiryWarning ? (
        <Alert tone="warning" role="status">
          El vencimiento registrado es anterior a la fecha de aplicación. Puedes documentar y
          guardar este dato.
        </Alert>
      ) : null}
      <Card className="form-card preventive-form-card">
        <form className="domain-form" onSubmit={(event) => void submit(event)} noValidate>
          <div className="preventive-form-context">
            <div>
              <p className="section-kicker">Contexto clínico</p>
              <h2>{parent.reason}</h2>
              <p>
                {patient.patient.name} · {ENCOUNTER_STATUS_LABEL[parent.status]}
              </p>
            </div>
            <Badge tone="neutral">Borrador</Badge>
          </div>
          <div className="form-grid form-grid--three">
            <DateField
              id="preventive-administered-on"
              label="Fecha de aplicación"
              value={field(form, 'administeredOn')}
              onChange={(value) => setValue('administeredOn', value)}
            />
            <DateField
              id="preventive-next-due-on"
              label="Próxima fecha"
              value={field(form, 'nextDueOn')}
              onChange={(value) => setValue('nextDueOn', value)}
            />
            {kind === 'vaccination' ? (
              <DateField
                id="preventive-expiry-on"
                label="Vencimiento del producto"
                value={field(form, 'expiryOn')}
                onChange={(value) => setValue('expiryOn', value)}
              />
            ) : null}
          </div>
          {kind === 'vaccination' ? (
            <div className="form-grid form-grid--two">
              <FormText
                id="vaccination-name"
                label="Nombre de la vacuna"
                value={field(form, 'vaccineName')}
                onChange={(value) => setValue('vaccineName', value)}
                maxLength={200}
              />
              <FormText
                id="vaccination-type"
                label="Tipo de vacuna"
                value={field(form, 'vaccineType')}
                onChange={(value) => setValue('vaccineType', value)}
                maxLength={120}
              />
              <FormText
                id="vaccination-route"
                label="Vía"
                value={field(form, 'route')}
                onChange={(value) => setValue('route', value)}
                maxLength={100}
              />
              <FormText
                id="vaccination-laboratory"
                label="Laboratorio"
                value={field(form, 'laboratoryName')}
                onChange={(value) => setValue('laboratoryName', value)}
                maxLength={160}
              />
              <FormText
                id="vaccination-lot"
                label="Lote"
                value={field(form, 'lotNumber')}
                onChange={(value) => setValue('lotNumber', value)}
                maxLength={120}
              />
              <FormText
                id="vaccination-dose"
                label="Dosis"
                value={field(form, 'doseText')}
                onChange={(value) => setValue('doseText', value)}
                maxLength={500}
              />
            </div>
          ) : (
            <div className="form-grid form-grid--two">
              <FormText
                id="deworming-product"
                label="Producto"
                value={field(form, 'productName')}
                onChange={(value) => setValue('productName', value)}
                maxLength={200}
              />
              <FormText
                id="deworming-type"
                label="Tipo de desparasitación"
                value={field(form, 'dewormingType')}
                onChange={(value) => setValue('dewormingType', value)}
                maxLength={120}
              />
              <FormText
                id="deworming-dose"
                label="Dosis"
                value={field(form, 'doseText')}
                onChange={(value) => setValue('doseText', value)}
                maxLength={500}
              />
            </div>
          )}
          <FormText
            id="preventive-notes"
            label="Notas"
            value={field(form, 'notes')}
            onChange={(value) => setValue('notes', value)}
            maxLength={5000}
            multiline
          />
          <MembersFields
            values={form}
            setValue={setValue}
            members={members.data?.data ?? []}
            disabled={saving}
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

export function VaccinationFormPage({ mode }: { mode: 'create' | 'edit' }) {
  return <PreventiveFormPage kind="vaccination" mode={mode} />;
}
export function DewormingFormPage({ mode }: { mode: 'create' | 'edit' }) {
  return <PreventiveFormPage kind="deworming" mode={mode} />;
}
