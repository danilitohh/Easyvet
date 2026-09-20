import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  createPatientRequestSchema,
  updatePatientRequestSchema,
  type CreatePatientRequest,
  type UpdatePatientRequest,
} from '@veterinary-saas/contracts';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { TextInput } from '../../components/ui/TextInput';
import { ApiError } from '../../services/apiClient';
import { ResourceError } from '../shared/ResourceFeedback';
import { useActiveOrganizationId } from '../shared/hooks';
import { errorMessage } from '../shared/resourceUtils';
import { useOwner, useOwners } from '../owners/useOwners';
import { patientsApi } from './patientsApi';
import { usePatient } from './usePatients';

type PatientFormState = {
  name: string;
  species: string;
  breed: string;
  sex: 'MALE' | 'FEMALE' | 'UNKNOWN';
  birthDate: string;
  birthDateEstimated: boolean;
  color: string;
  microchipNumber: string;
  currentWeightKg: string;
  sterilized: boolean;
  notes: string;
};

const EMPTY_FORM: PatientFormState = {
  name: '',
  species: '',
  breed: '',
  sex: 'UNKNOWN',
  birthDate: '',
  birthDateEstimated: false,
  color: '',
  microchipNumber: '',
  currentWeightKg: '',
  sterilized: false,
  notes: '',
};

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function formFromPatient(
  patient: NonNullable<ReturnType<typeof usePatient>['patient']>,
): PatientFormState {
  return {
    name: patient.name,
    species: patient.species,
    breed: patient.breed ?? '',
    sex: patient.sex,
    birthDate: patient.birthDate ?? '',
    birthDateEstimated: patient.birthDateEstimated,
    color: patient.color ?? '',
    microchipNumber: patient.microchipNumber ?? '',
    currentWeightKg: patient.currentWeightKg?.toString() ?? '',
    sterilized: patient.sterilized,
    notes: patient.notes ?? '',
  };
}

function fieldErrorMap(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues.reduce<Record<string, string>>((messages, issue) => {
    const field = issue.path[0];
    if (typeof field === 'string' && !messages[field]) messages[field] = issue.message;
    return messages;
  }, {});
}

// Patient form requires an API-backed Owner selection and keeps ownership immutable during edit.
export function PatientFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { patientId } = useParams<{ patientId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialOwnerId = mode === 'create' ? (searchParams.get('ownerId') ?? undefined) : undefined;
  const patientState = usePatient(mode === 'edit' ? patientId : undefined);
  const selectedOwnerState = useOwner(initialOwnerId);
  const organizationId = useActiveOrganizationId();
  const previousOrganizationId = useRef(organizationId);
  const [ownerSearch, setOwnerSearch] = useState('');
  const ownerParams = useMemo(
    () => ({
      page: 1,
      pageSize: 50,
      search: ownerSearch.trim(),
      status: 'ACTIVE' as const,
      sortBy: 'firstName' as const,
      sortDirection: 'asc' as const,
    }),
    [ownerSearch],
  );
  const ownerOptions = useOwners(ownerParams);
  const [selectedOwnerId, setSelectedOwnerId] = useState(initialOwnerId ?? '');
  const [form, setForm] = useState<PatientFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  // A create form cannot carry an Owner selection across an organization switch.
  useEffect(() => {
    if (
      mode === 'create' &&
      previousOrganizationId.current &&
      previousOrganizationId.current !== organizationId
    ) {
      setSelectedOwnerId('');
      setOwnerSearch('');
      setErrors({});
      setServerError(null);
    }
    previousOrganizationId.current = organizationId;
  }, [mode, organizationId]);

  useEffect(() => {
    if (mode === 'edit' && patientState.patient) {
      setForm(formFromPatient(patientState.patient));
      setSelectedOwnerId(patientState.patient.ownerId);
    }
  }, [mode, patientState.patient]);

  useEffect(() => {
    if (mode === 'create' && selectedOwnerState.owner)
      setSelectedOwnerId(selectedOwnerState.owner.id);
  }, [mode, selectedOwnerState.owner]);

  if (mode === 'edit' && patientState.loading)
    return (
      <Card className="resource-card">
        <LoadingState label="Cargando paciente" />
      </Card>
    );
  if (mode === 'edit' && patientState.error)
    return <ResourceError error={patientState.error} onRetry={patientState.reload} />;
  if (mode === 'edit' && !patientState.patient)
    return <ResourceError error={new ApiError('Resource not found', 404, 'RESOURCE_NOT_FOUND')} />;

  function update<K extends keyof PatientFormState>(field: K, value: PatientFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
    setServerError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      ...(mode === 'create' ? { ownerId: selectedOwnerId } : {}),
      name: form.name,
      species: form.species,
      breed: nullable(form.breed),
      sex: form.sex,
      birthDate: nullable(form.birthDate),
      birthDateEstimated: form.birthDateEstimated,
      color: nullable(form.color),
      microchipNumber: nullable(form.microchipNumber),
      currentWeightKg: form.currentWeightKg.trim() ? Number(form.currentWeightKg) : null,
      sterilized: form.sterilized,
      notes: nullable(form.notes),
    };
    const parsed =
      mode === 'create'
        ? createPatientRequestSchema.safeParse(payload)
        : updatePatientRequestSchema.safeParse(payload);
    const nextErrors = parsed.success ? {} : fieldErrorMap(parsed.error);
    if (mode === 'create' && !selectedOwnerId) nextErrors.ownerId = 'Selecciona un propietario.';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      const saved =
        mode === 'create'
          ? await patientsApi.create(payload as CreatePatientRequest)
          : await patientsApi.update(patientId ?? '', payload as UpdatePatientRequest);
      navigate(`/pacientes/${saved.id}`);
    } catch (requestError: unknown) {
      setServerError(requestError);
    } finally {
      setSaving(false);
    }
  }

  const selectedOwner = mode === 'edit' ? patientState.patient?.owner : selectedOwnerState.owner;
  const ownerOptionsData = ownerOptions.data?.data ?? [];
  const hasSelectedOption =
    selectedOwnerId && ownerOptionsData.some((owner) => owner.id === selectedOwnerId);
  const backPath = mode === 'create' ? '/pacientes' : `/pacientes/${patientId}`;
  const title = mode === 'create' ? 'Nuevo paciente' : 'Editar paciente';
  const input = (field: keyof PatientFormState, label: string, type = 'text') => (
    <FormField label={label} htmlFor={`patient-${field}`}>
      <TextInput
        id={`patient-${field}`}
        type={type}
        value={form[field] as string}
        {...(field === 'birthDate' ? { max: new Date().toISOString().slice(0, 10) } : {})}
        onChange={(event) => update(field, event.target.value as PatientFormState[typeof field])}
        aria-invalid={Boolean(errors[field])}
      />
      {errors[field] ? (
        <span className="field-error" role="alert">
          {errors[field]}
        </span>
      ) : null}
    </FormField>
  );

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Pacientes"
        title={title}
        description="Registra los datos actuales del paciente sin adelantar módulos clínicos."
      />
      <Card className="form-card">
        <form className="domain-form" onSubmit={(event) => void submit(event)} noValidate>
          {serverError ? (
            <Alert tone="error" role="alert">
              {errorMessage(serverError, 'No fue posible guardar el paciente.')}
            </Alert>
          ) : null}
          {mode === 'create' ? (
            <div className="form-section">
              <div>
                <p className="section-kicker">Responsable</p>
                <h2>Selecciona un propietario</h2>
              </div>
              <p>La búsqueda consulta únicamente propietarios activos de la organización actual.</p>
            </div>
          ) : (
            <div className="form-section">
              <div>
                <p className="section-kicker">Responsable</p>
                <h2>Propietario principal</h2>
              </div>
              <p>El propietario no se cambia durante esta fase.</p>
            </div>
          )}
          {mode === 'create' ? (
            <div className="owner-picker">
              <FormField label="Buscar propietario" htmlFor="patient-owner-search">
                <TextInput
                  id="patient-owner-search"
                  value={ownerSearch}
                  onChange={(event) => setOwnerSearch(event.target.value)}
                  placeholder="Nombre, documento o correo"
                />
              </FormField>
              <FormField label="Propietario *" htmlFor="patient-owner">
                <Select
                  id="patient-owner"
                  aria-invalid={Boolean(errors.ownerId)}
                  value={selectedOwnerId}
                  onChange={(event) => setSelectedOwnerId(event.target.value)}
                >
                  <option value="">Selecciona un propietario</option>
                  {selectedOwner && !hasSelectedOption ? (
                    <option value={selectedOwner.id}>
                      {selectedOwner.firstName} {selectedOwner.lastName ?? ''}
                    </option>
                  ) : null}
                  {ownerOptionsData.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.firstName} {owner.lastName ?? ''}
                      {owner.documentNumber ? ` · ${owner.documentNumber}` : ''}
                    </option>
                  ))}
                </Select>
                {errors.ownerId ? (
                  <span className="field-error" role="alert">
                    {errors.ownerId}
                  </span>
                ) : null}
              </FormField>
            </div>
          ) : selectedOwner ? (
            <div className="selected-owner-note">
              <strong>
                {selectedOwner.firstName} {selectedOwner.lastName ?? ''}
              </strong>
              <span>{selectedOwner.phone ?? selectedOwner.email ?? 'Sin contacto registrado'}</span>
            </div>
          ) : null}
          <div className="form-section">
            <div>
              <p className="section-kicker">Identidad</p>
              <h2>Datos del paciente</h2>
            </div>
          </div>
          <div className="form-grid form-grid--two">
            {input('name', 'Nombre *')}
            {input('species', 'Especie *')}
            {input('breed', 'Raza')}
            <FormField label="Sexo" htmlFor="patient-sex">
              <Select
                id="patient-sex"
                value={form.sex}
                onChange={(event) => update('sex', event.target.value as PatientFormState['sex'])}
              >
                <option value="UNKNOWN">No especificado</option>
                <option value="FEMALE">Hembra</option>
                <option value="MALE">Macho</option>
              </Select>
            </FormField>
            {input('birthDate', 'Fecha de nacimiento', 'date')}
            <FormField label="Fecha estimada" htmlFor="patient-birthDateEstimated">
              <label className="checkbox-field">
                <input
                  id="patient-birthDateEstimated"
                  type="checkbox"
                  checked={form.birthDateEstimated}
                  onChange={(event) => update('birthDateEstimated', event.target.checked)}
                />{' '}
                La fecha es aproximada
              </label>
            </FormField>
            {input('color', 'Color')}
            {input('microchipNumber', 'Microchip')}
            {input('currentWeightKg', 'Peso actual (kg)', 'number')}
            <FormField label="Esterilización" htmlFor="patient-sterilized">
              <label className="checkbox-field">
                <input
                  id="patient-sterilized"
                  type="checkbox"
                  checked={form.sterilized}
                  onChange={(event) => update('sterilized', event.target.checked)}
                />{' '}
                Está esterilizado
              </label>
            </FormField>
          </div>
          <FormField label="Notas" htmlFor="patient-notes">
            <textarea
              id="patient-notes"
              className="input input--textarea"
              value={form.notes}
              onChange={(event) => update('notes', event.target.value)}
              aria-invalid={Boolean(errors.notes)}
            />
            {errors.notes ? (
              <span className="field-error" role="alert">
                {errors.notes}
              </span>
            ) : null}
          </FormField>
          <div className="form-actions">
            <Button as={Link} to={backPath} variant="secondary">
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar paciente'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
