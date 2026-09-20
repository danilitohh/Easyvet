import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  createOwnerRequestSchema,
  type CreateOwnerRequest,
  type UpdateOwnerRequest,
} from '@veterinary-saas/contracts';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { TextInput } from '../../components/ui/TextInput';
import { ApiError } from '../../services/apiClient';
import { ResourceError } from '../shared/ResourceFeedback';
import { errorMessage } from '../shared/resourceUtils';
import { ownersApi } from './ownersApi';
import { useOwner } from './useOwners';

type OwnerFormState = {
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  email: string;
  phone: string;
  secondaryPhone: string;
  address: string;
  city: string;
  notes: string;
};

const EMPTY_FORM: OwnerFormState = {
  firstName: '',
  lastName: '',
  documentType: '',
  documentNumber: '',
  email: '',
  phone: '',
  secondaryPhone: '',
  address: '',
  city: '',
  notes: '',
};

function formFromOwner(owner: NonNullable<ReturnType<typeof useOwner>['owner']>): OwnerFormState {
  return {
    firstName: owner.firstName,
    lastName: owner.lastName ?? '',
    documentType: owner.documentType ?? '',
    documentNumber: owner.documentNumber ?? '',
    email: owner.email ?? '',
    phone: owner.phone ?? '',
    secondaryPhone: owner.secondaryPhone ?? '',
    address: owner.address ?? '',
    city: owner.city ?? '',
    notes: owner.notes ?? '',
  };
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function fieldErrorMap(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues.reduce<Record<string, string>>((messages, issue) => {
    const field = issue.path[0];
    if (typeof field === 'string' && !messages[field]) messages[field] = issue.message;
    return messages;
  }, {});
}

// Owner form is shared by create and edit while keeping lifecycle and tenant fields impossible to submit.
export function OwnerFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { ownerId } = useParams<{ ownerId: string }>();
  const navigate = useNavigate();
  const ownerState = useOwner(mode === 'edit' ? ownerId : undefined);
  const [form, setForm] = useState<OwnerFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && ownerState.owner) setForm(formFromOwner(ownerState.owner));
  }, [mode, ownerState.owner]);

  if (mode === 'edit' && ownerState.loading)
    return (
      <Card className="resource-card">
        <LoadingState label="Cargando propietario" />
      </Card>
    );
  if (mode === 'edit' && ownerState.error)
    return <ResourceError error={ownerState.error} onRetry={ownerState.reload} />;
  if (mode === 'edit' && !ownerState.owner)
    return <ResourceError error={new ApiError('Resource not found', 404, 'RESOURCE_NOT_FOUND')} />;

  function update(field: keyof OwnerFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
    setServerError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      firstName: form.firstName,
      lastName: nullable(form.lastName),
      documentType: nullable(form.documentType),
      documentNumber: nullable(form.documentNumber),
      email: nullable(form.email),
      phone: nullable(form.phone),
      secondaryPhone: nullable(form.secondaryPhone),
      address: nullable(form.address),
      city: nullable(form.city),
      notes: nullable(form.notes),
    };
    const parsed = createOwnerRequestSchema.safeParse(payload);
    const nextErrors = parsed.success ? {} : fieldErrorMap(parsed.error);
    if (
      (payload.documentType && !payload.documentNumber) ||
      (!payload.documentType && payload.documentNumber)
    ) {
      nextErrors.documentNumber = 'Tipo y número de documento deben completarse juntos.';
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      const saved =
        mode === 'create'
          ? await ownersApi.create(payload as CreateOwnerRequest)
          : await ownersApi.update(ownerId ?? '', payload as UpdateOwnerRequest);
      navigate(`/propietarios/${saved.id}`);
    } catch (requestError: unknown) {
      setServerError(requestError);
    } finally {
      setSaving(false);
    }
  }

  const title = mode === 'create' ? 'Nuevo propietario' : 'Editar propietario';
  const backPath = mode === 'create' ? '/propietarios' : `/propietarios/${ownerId}`;
  const input = (field: keyof OwnerFormState, label: string, type = 'text', hint?: string) => (
    <FormField label={label} htmlFor={`owner-${field}`} {...(hint ? { hint } : {})}>
      <TextInput
        id={`owner-${field}`}
        type={type}
        value={form[field]}
        onChange={(event) => update(field, event.target.value)}
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
        eyebrow="Propietarios"
        title={title}
        description="Completa únicamente los datos que el sistema necesita para este registro."
      />
      <Card className="form-card">
        <form className="domain-form" onSubmit={(event) => void submit(event)} noValidate>
          {serverError ? (
            <Alert tone="error" role="alert">
              {errorMessage(serverError, 'No fue posible guardar el propietario.')}
            </Alert>
          ) : null}
          <div className="form-section">
            <div>
              <p className="section-kicker">Identidad</p>
              <h2>Datos principales</h2>
            </div>
            <p>Los campos con validación se revisan antes de enviar al servidor.</p>
          </div>
          <div className="form-grid form-grid--two">
            {input('firstName', 'Nombre *')}
            {input('lastName', 'Apellido')}
            {input('documentType', 'Tipo de documento')}
            {input('documentNumber', 'Número de documento')}
          </div>
          <div className="form-section">
            <div>
              <p className="section-kicker">Contacto</p>
              <h2>Cómo encontrarlo</h2>
            </div>
          </div>
          <div className="form-grid form-grid--two">
            {input('email', 'Correo electrónico', 'email')}
            {input('phone', 'Teléfono principal')}
            {input('secondaryPhone', 'Teléfono secundario')}
            {input('city', 'Ciudad')}
            {input('address', 'Dirección')}
          </div>
          <FormField
            label="Notas"
            htmlFor="owner-notes"
            hint="Información útil para el equipo. No reemplaza una historia clínica."
          >
            <textarea
              id="owner-notes"
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
              {saving ? 'Guardando…' : 'Guardar propietario'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
