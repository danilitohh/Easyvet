import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type {
  AvailabilityRuleRequest,
  AvailabilityRuleResponse,
  MembershipResponse,
} from '@veterinary-saas/contracts';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { LoadingState } from '../../components/ui/LoadingState';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { TextInput } from '../../components/ui/TextInput';
import { useCan } from '../../auth/useCan';
import { PERMISSION } from '../../auth/permissions';
import { ApiError } from '../../services/apiClient';
import { ResourceError } from '../shared/ResourceFeedback';
import { errorMessage } from '../shared/resourceUtils';
import { DAY_OF_WEEK_LABELS, DAY_OF_WEEK_OPTIONS } from './agendaUtils';
import { agendaApi } from './agendaApi';
import {
  notifyAvailabilityChanged,
  useAgendaAvailability,
  useAgendaOrganization,
  useAgendaReferenceData,
} from './useAgenda';
import { useActiveOrganizationId } from '../shared/hooks';

type AvailabilityFormState = Omit<AvailabilityRuleRequest, 'slotMinutes'> & {
  slotMinutes: string;
};

const EMPTY_FORM: AvailabilityFormState = {
  clinicLocationId: '',
  membershipId: '',
  dayOfWeek: 1,
  startLocalTime: '09:00',
  endLocalTime: '18:00',
  slotMinutes: '30',
  notes: '',
};

function formFromRule(rule: AvailabilityRuleResponse): AvailabilityFormState {
  return {
    clinicLocationId: rule.clinicLocationId,
    membershipId: rule.membershipId ?? '',
    dayOfWeek: rule.dayOfWeek,
    startLocalTime: rule.startLocalTime,
    endLocalTime: rule.endLocalTime,
    slotMinutes: String(rule.slotMinutes),
    notes: rule.notes ?? '',
  };
}

function minutes(value: string): number {
  const [hours = 0, mins = 0] = value.split(':').map(Number);
  return hours * 60 + mins;
}

function professionalName(
  rule: AvailabilityRuleResponse,
  memberships: MembershipResponse[] | undefined,
): string {
  const membership = memberships?.find((item) => item.id === rule.membershipId);
  return membership ? `${membership.user.email} · ${membership.role}` : 'Profesional específico';
}

// Availability administration keeps civil recurring rules separate from the main calendar.
export function AvailabilityPage() {
  const { ruleId } = useParams<{ ruleId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const organizationId = useActiveOrganizationId();
  const organization = useAgendaOrganization();
  const references = useAgendaReferenceData();
  const availability = useAgendaAvailability();
  const canManage = useCan(PERMISSION.AVAILABILITY_MANAGE);
  const isCreateRoute = location.pathname.endsWith('/nueva');
  const formOpen = Boolean(ruleId || isCreateRoute);
  const [form, setForm] = useState<AvailabilityFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [pendingRule, setPendingRule] = useState<AvailabilityRuleResponse | null>(null);
  const [pendingAction, setPendingAction] = useState<'deactivate' | 'activate' | null>(null);
  const originalOrganizationRef = useRef(organizationId);

  const activeLocations = useMemo(
    () => references.data?.locations.filter((location) => location.status === 'ACTIVE') ?? [],
    [references.data],
  );
  const activeMemberships = useMemo(
    () => references.data?.memberships.filter((membership) => membership.status === 'ACTIVE') ?? [],
    [references.data],
  );
  const editingRule = ruleId ? availability.data?.find((rule) => rule.id === ruleId) : null;
  const visibleRules = useMemo(
    () =>
      (availability.data ?? []).filter(
        (rule) => filter === 'ALL' || (filter === 'ACTIVE' ? rule.isActive : !rule.isActive),
      ),
    [availability.data, filter],
  );
  const groupedRules = useMemo(() => {
    const groups = new Map<string, AvailabilityRuleResponse[]>();
    visibleRules.forEach((rule) =>
      groups.set(rule.clinicLocationId, [...(groups.get(rule.clinicLocationId) ?? []), rule]),
    );
    return [...groups.entries()];
  }, [visibleRules]);
  const activeRuleCount = (availability.data ?? []).filter((rule) => rule.isActive).length;

  useEffect(() => {
    if (originalOrganizationRef.current && organizationId !== originalOrganizationRef.current) {
      originalOrganizationRef.current = organizationId;
      setForm(EMPTY_FORM);
      setServerError(null);
      navigate('/agenda/disponibilidad', { replace: true });
    }
  }, [navigate, organizationId]);

  useEffect(() => {
    if (editingRule) setForm(formFromRule(editingRule));
    else if (isCreateRoute && activeLocations[0] && !form.clinicLocationId) {
      setForm((current) => ({ ...current, clinicLocationId: activeLocations[0]!.id }));
    }
  }, [activeLocations, editingRule, form.clinicLocationId, isCreateRoute, ruleId]);

  const update = (field: keyof AvailabilityFormState, value: string | number) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: '' }));
    setServerError(null);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !organizationId || originalOrganizationRef.current !== organizationId) return;
    const errors: Record<string, string> = {};
    const slotMinutes = Number(form.slotMinutes);
    if (!form.clinicLocationId) errors.clinicLocationId = 'Selecciona una sede.';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.startLocalTime))
      errors.startLocalTime = 'Usa HH:mm.';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.endLocalTime)) errors.endLocalTime = 'Usa HH:mm.';
    if (
      form.startLocalTime &&
      form.endLocalTime &&
      minutes(form.endLocalTime) <= minutes(form.startLocalTime)
    ) {
      errors.endLocalTime = 'La hora final debe ser posterior.';
    }
    if (!Number.isInteger(slotMinutes) || slotMinutes < 15 || slotMinutes > 240) {
      errors.slotMinutes = 'Usa un intervalo entre 15 y 240 minutos.';
    }
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      const payload: AvailabilityRuleRequest = {
        clinicLocationId: form.clinicLocationId,
        membershipId: form.membershipId || null,
        dayOfWeek: Number(form.dayOfWeek),
        startLocalTime: form.startLocalTime,
        endLocalTime: form.endLocalTime,
        slotMinutes,
        notes: form.notes?.trim() || null,
      };
      if (ruleId) await agendaApi.updateAvailability(ruleId, payload);
      else await agendaApi.createAvailability(payload);
      notifyAvailabilityChanged();
      availability.reload();
      navigate('/agenda/disponibilidad', { replace: true });
    } catch (error: unknown) {
      setServerError(error);
    } finally {
      setSaving(false);
    }
  }

  async function confirmActivationChange() {
    if (!pendingRule || !pendingAction) return;
    setSaving(true);
    setServerError(null);
    try {
      if (pendingAction === 'deactivate') await agendaApi.deactivateAvailability(pendingRule.id);
      else await agendaApi.updateAvailability(pendingRule.id, { isActive: true });
      notifyAvailabilityChanged();
      setPendingRule(null);
      setPendingAction(null);
      availability.reload();
    } catch (error: unknown) {
      setServerError(error);
    } finally {
      setSaving(false);
    }
  }

  if (organization.loading || references.loading || availability.loading) {
    return (
      <Card className="resource-card">
        <LoadingState label="Cargando disponibilidad" />
      </Card>
    );
  }
  if (availability.error)
    return <ResourceError error={availability.error} onRetry={availability.reload} />;
  if (ruleId && !editingRule) {
    return <ResourceError error={new ApiError('Resource not found', 404, 'RESOURCE_NOT_FOUND')} />;
  }

  return (
    <div className="page-stack availability-page">
      <PageHeader
        eyebrow="Agenda · Configuración"
        title="Disponibilidad"
        description={`Horarios civiles recurrentes de ${organization.data?.name ?? 'la organización'} (${organization.data?.timezone ?? 'zona local'}).`}
        action={
          canManage ? (
            <Button as={Link} to="/agenda/disponibilidad/nueva">
              Nueva regla
            </Button>
          ) : null
        }
      />
      <Alert tone="info">
        Si no hay reglas activas aplicables, Easyvet permite reservar cualquier hora (UNRESTRICTED).
        Las excepciones de horario se implementarán posteriormente.
      </Alert>
      {serverError ? (
        <Alert tone="error" role="alert">
          {errorMessage(serverError, 'No fue posible actualizar la disponibilidad.')}
        </Alert>
      ) : null}
      {formOpen ? (
        <Card className="resource-card">
          <div className="availability-form-heading">
            <div>
              <p className="section-kicker">{editingRule ? 'Editar regla' : 'Nueva regla'}</p>
              <h2>{editingRule ? 'Actualizar horario' : 'Crear horario'}</h2>
            </div>
            <Button as={Link} to="/agenda/disponibilidad" variant="ghost">
              Cancelar
            </Button>
          </div>
          {canManage ? (
            <AvailabilityForm
              form={form}
              errors={formErrors}
              locations={activeLocations}
              memberships={activeMemberships}
              saving={saving}
              onChange={update}
              onSubmit={submit}
            />
          ) : (
            <Alert tone="warning">No tienes permiso para modificar disponibilidad.</Alert>
          )}
        </Card>
      ) : null}
      <Card className="resource-card availability-list-card">
        <div className="availability-list-heading">
          <div>
            <p className="section-kicker">Reglas por sede</p>
            <h2>Horarios recurrentes</h2>
          </div>
          <Select
            aria-label="Filtrar reglas por estado"
            value={filter}
            onChange={(event) => setFilter(event.target.value as typeof filter)}
          >
            <option value="ALL">Todas</option>
            <option value="ACTIVE">Activas</option>
            <option value="INACTIVE">Inactivas</option>
          </Select>
        </div>
        {groupedRules.length === 0 ? (
          <p className="availability-empty">No hay reglas que coincidan con el filtro.</p>
        ) : (
          groupedRules.map(([locationId, rules]) => {
            const location = references.data?.locations.find((item) => item.id === locationId);
            return (
              <section className="availability-location-group" key={locationId}>
                <h3>{location?.name ?? 'Sede no disponible'}</h3>
                <div className="availability-rule-list">
                  {rules.map((rule) => (
                    <article className="availability-rule" key={rule.id}>
                      <div className="availability-rule__main">
                        <div>
                          <strong>{DAY_OF_WEEK_LABELS[rule.dayOfWeek]}</strong>
                          <span>
                            {rule.startLocalTime}–{rule.endLocalTime}
                          </span>
                        </div>
                        <p>
                          {rule.membershipId
                            ? professionalName(rule, references.data?.memberships)
                            : 'Horario general de sede'}{' '}
                          · intervalo de {rule.slotMinutes} min
                        </p>
                        {rule.notes ? <small>{rule.notes}</small> : null}
                      </div>
                      <div className="availability-rule__actions">
                        <Badge tone={rule.isActive ? 'success' : 'neutral'}>
                          {rule.isActive ? 'Activa' : 'Inactiva'}
                        </Badge>
                        {canManage ? (
                          <>
                            <Button
                              as={Link}
                              to={`/agenda/disponibilidad/${rule.id}/editar`}
                              variant="secondary"
                            >
                              Editar
                            </Button>
                            <Button
                              type="button"
                              variant={rule.isActive ? 'danger' : 'secondary'}
                              onClick={() => {
                                setPendingRule(rule);
                                setPendingAction(rule.isActive ? 'deactivate' : 'activate');
                              }}
                            >
                              {rule.isActive ? 'Desactivar' : 'Activar'}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })
        )}
        {activeRuleCount === 0 ? (
          <Alert tone="warning">
            No hay reglas activas aplicables: el sistema está en modo UNRESTRICTED.
          </Alert>
        ) : null}
      </Card>
      <Modal
        open={Boolean(pendingRule && pendingAction)}
        title={pendingAction === 'deactivate' ? 'Desactivar regla' : 'Activar regla'}
        description={
          pendingAction === 'deactivate' && activeRuleCount === 1
            ? 'Esta es la última regla activa. Al desactivarla, la agenda volverá a UNRESTRICTED.'
            : 'La disponibilidad se actualizará para nuevas reservas y reprogramaciones.'
        }
        eyebrow="Agenda · Confirmación"
        onClose={() => {
          setPendingRule(null);
          setPendingAction(null);
        }}
      >
        <div className="modal-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setPendingRule(null);
              setPendingAction(null);
            }}
          >
            Volver
          </Button>
          <Button
            type="button"
            variant={pendingAction === 'deactivate' ? 'danger' : 'primary'}
            disabled={saving}
            onClick={() => void confirmActivationChange()}
          >
            {saving
              ? 'Guardando…'
              : pendingAction === 'deactivate'
                ? 'Confirmar desactivación'
                : 'Confirmar activación'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

type AvailabilityFormProps = {
  form: AvailabilityFormState;
  errors: Record<string, string>;
  locations: Array<{ id: string; name: string; status: string }>;
  memberships: Array<{
    id: string;
    role: string;
    status: string;
    user: { email: string; displayName: string | null };
  }>;
  saving: boolean;
  onChange: (field: keyof AvailabilityFormState, value: string | number) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function AvailabilityForm({
  form,
  errors,
  locations,
  memberships,
  saving,
  onChange,
  onSubmit,
}: AvailabilityFormProps) {
  return (
    <form className="domain-form availability-form" onSubmit={onSubmit} noValidate>
      <FormField label="Sede *" htmlFor="availability-location">
        <Select
          id="availability-location"
          value={form.clinicLocationId}
          onChange={(event) => onChange('clinicLocationId', event.target.value)}
        >
          <option value="">Selecciona una sede</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </Select>
        {errors.clinicLocationId ? (
          <span className="form-field__error">{errors.clinicLocationId}</span>
        ) : null}
      </FormField>
      <FormField
        label="Profesional"
        htmlFor="availability-membership"
        hint="Vacío significa horario general de sede."
      >
        <Select
          id="availability-membership"
          value={form.membershipId ?? ''}
          onChange={(event) => onChange('membershipId', event.target.value)}
        >
          <option value="">Horario general de sede</option>
          {memberships.map((membership) => (
            <option key={membership.id} value={membership.id}>
              {membership.user.email} · {membership.role}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Día de la semana" htmlFor="availability-day">
        <Select
          id="availability-day"
          value={String(form.dayOfWeek)}
          onChange={(event) => onChange('dayOfWeek', Number(event.target.value))}
        >
          {DAY_OF_WEEK_OPTIONS.map((day) => (
            <option key={day.value} value={day.value}>
              {day.label}
            </option>
          ))}
        </Select>
      </FormField>
      <div className="form-grid form-grid--two">
        <FormField label="Inicio local" htmlFor="availability-start">
          <TextInput
            id="availability-start"
            type="time"
            value={form.startLocalTime}
            onChange={(event) => onChange('startLocalTime', event.target.value)}
          />
          {errors.startLocalTime ? (
            <span className="form-field__error">{errors.startLocalTime}</span>
          ) : null}
        </FormField>
        <FormField label="Fin local" htmlFor="availability-end">
          <TextInput
            id="availability-end"
            type="time"
            value={form.endLocalTime}
            onChange={(event) => onChange('endLocalTime', event.target.value)}
          />
          {errors.endLocalTime ? (
            <span className="form-field__error">{errors.endLocalTime}</span>
          ) : null}
        </FormField>
      </div>
      <FormField
        label="Intervalo de sugerencia (minutos)"
        htmlFor="availability-slot"
        hint="Entre 15 y 240 minutos; no obliga a que la cita dure lo mismo."
      >
        <TextInput
          id="availability-slot"
          type="number"
          min={15}
          max={240}
          step={15}
          value={form.slotMinutes}
          onChange={(event) => onChange('slotMinutes', event.target.value)}
        />
        {errors.slotMinutes ? (
          <span className="form-field__error">{errors.slotMinutes}</span>
        ) : null}
      </FormField>
      <FormField label="Notas" htmlFor="availability-notes">
        <TextInput
          id="availability-notes"
          value={form.notes ?? ''}
          onChange={(event) => onChange('notes', event.target.value)}
        />
      </FormField>
      <div className="modal-actions">
        <Button type="submit" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar regla'}
        </Button>
      </div>
    </form>
  );
}
