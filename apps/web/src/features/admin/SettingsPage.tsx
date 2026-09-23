import { useEffect, useRef, useState, type FormEvent } from 'react';
import type {
  CommercialSettingsResponse,
  LocationResponse,
  OrganizationCurrentResponse,
} from '@veterinary-saas/contracts';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { LoadingState } from '../../components/ui/LoadingState';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { TextInput } from '../../components/ui/TextInput';
import { useCan } from '../../auth/useCan';
import { PERMISSION } from '../../auth/permissions';
import { useAuth } from '../../contexts/useAuth';
import { ApiError } from '../../services/apiClient';
import { adminApi } from './adminApi';
import './admin.css';

type SettingsTab = 'general' | 'locations' | 'commercial';

function settingsError(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback;
  if (error.code === 'INVALID_TIMEZONE')
    return 'Ingresa una zona horaria IANA válida, por ejemplo America/Bogota.';
  if (error.code === 'INVALID_INVOICE_PREFIX')
    return 'El prefijo solo puede contener letras, números y guiones.';
  if (error.code === 'LOCATION_HAS_OPEN_CASH_SESSION')
    return 'Cierra la caja de esta sede antes de inactivarla.';
  if (error.code === 'LOCATION_HAS_ACTIVE_GROOMING')
    return 'Completa el servicio de peluquería en curso antes de inactivar la sede.';
  if (error.code === 'LOCATION_HAS_FUTURE_APPOINTMENTS')
    return 'Reprograma o cancela las citas futuras antes de inactivar la sede.';
  return fallback;
}

// Organization settings are grouped into three small tenant-scoped sections, not a global settings maze.
export function SettingsPage() {
  const { activeMembership } = useAuth();
  const organizationId = activeMembership?.organization.id ?? '';
  const canRead = useCan(PERMISSION.ORGANIZATION_SETTINGS_READ);
  const canUpdate = useCan(PERMISSION.ORGANIZATION_SETTINGS_UPDATE);
  const [organization, setOrganization] = useState<OrganizationCurrentResponse | null>(null);
  const [commercial, setCommercial] = useState<CommercialSettingsResponse | null>(null);
  const [locations, setLocations] = useState<LocationResponse[]>([]);
  const [tab, setTab] = useState<SettingsTab>('general');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!organizationId || !canRead) return undefined;
    const controller = new AbortController();
    setOrganization(null);
    setCommercial(null);
    setLocations([]);
    setLoading(true);
    setError('');
    Promise.all([
      adminApi.organizationSettings(controller.signal),
      adminApi.commercialSettings(controller.signal),
      adminApi.listLocations(controller.signal),
    ])
      .then(([org, defaults, branches]) => {
        if (controller.signal.aborted) return;
        setOrganization(org);
        setCommercial(defaults);
        setLocations(branches);
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted)
          setError(settingsError(caught, 'No fue posible cargar la configuración.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [canRead, organizationId]);

  async function refreshLocations(signal?: AbortSignal) {
    setLocations(await adminApi.listLocations(signal));
  }

  function showNotice(message: string) {
    setNotice(message);
    setError('');
  }

  if (loading || (organization !== null && organization.id !== organizationId)) {
    return <LoadingState label="Cargando configuración…" />;
  }
  if (!organization || !commercial) {
    return (
      <div className="page-stack admin-page">
        <PageHeader
          eyebrow="Gestión"
          title="Configuración"
          description="La configuración de esta organización no está disponible."
        />
        {error ? <Alert tone="error">{error}</Alert> : null}
      </div>
    );
  }

  return (
    <div className="page-stack admin-page">
      <PageHeader
        eyebrow="Gestión de la organización"
        title="Configuración"
        description="Datos generales, sedes y preferencias comerciales que aplican a nuevas operaciones."
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      <div className="admin-tabs" role="tablist" aria-label="Secciones de configuración">
        {(
          [
            ['general', 'General'],
            ['locations', 'Sedes'],
            ['commercial', 'Comercial'],
          ] as const
        ).map(([value, label]) => (
          <button
            className={tab === value ? 'admin-tab is-active' : 'admin-tab'}
            key={value}
            id={`settings-tab-${value}`}
            type="button"
            role="tab"
            aria-selected={tab === value}
            aria-controls={`settings-panel-${value}`}
            onClick={() => {
              setTab(value);
              setError('');
              setNotice('');
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'general' ? (
        <section id="settings-panel-general" role="tabpanel" aria-labelledby="settings-tab-general">
          <GeneralSettingsForm
            key={organizationId}
            organization={organization}
            disabled={!canUpdate}
            onSaved={(updated) => {
              setOrganization(updated);
              showNotice('La información general quedó guardada.');
            }}
            onError={setError}
          />
        </section>
      ) : null}
      {tab === 'locations' ? (
        <section
          id="settings-panel-locations"
          role="tabpanel"
          aria-labelledby="settings-tab-locations"
        >
          <LocationsSettings
            key={organizationId}
            locations={locations}
            canUpdate={canUpdate}
            onRefresh={refreshLocations}
            onNotice={showNotice}
            onError={setError}
          />
        </section>
      ) : null}
      {tab === 'commercial' ? (
        <section
          id="settings-panel-commercial"
          role="tabpanel"
          aria-labelledby="settings-tab-commercial"
        >
          <CommercialSettingsForm
            key={organizationId}
            settings={commercial}
            disabled={!canUpdate}
            onSaved={(updated) => {
              setCommercial(updated);
              setOrganization((current) =>
                current ? { ...current, currencyCode: updated.currencyCode } : current,
              );
              showNotice('Las preferencias comerciales quedaron guardadas.');
            }}
            onError={setError}
          />
        </section>
      ) : null}
    </div>
  );
}

type FormFeedback = { onError: (message: string) => void };

// General fields preserve the immutable slug and organization lifecycle status.
function GeneralSettingsForm({
  organization,
  disabled,
  onSaved,
  onError,
}: {
  organization: OrganizationCurrentResponse;
  disabled: boolean;
  onSaved: (organization: OrganizationCurrentResponse) => void;
} & FormFeedback) {
  const [name, setName] = useState(organization.name);
  const [timezone, setTimezone] = useState(organization.timezone);
  const [locale, setLocale] = useState(organization.locale);
  const [saving, setSaving] = useState(false);
  const mutationController = useRef<AbortController | null>(null);

  useEffect(() => () => mutationController.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onError('');
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone.trim() });
    } catch {
      onError('Ingresa una zona horaria IANA válida, por ejemplo America/Bogota.');
      return;
    }
    setSaving(true);
    mutationController.current?.abort();
    const controller = new AbortController();
    mutationController.current = controller;
    try {
      onSaved(await adminApi.updateOrganization({ name, timezone, locale }, controller.signal));
    } catch (caught) {
      if (!controller.signal.aborted)
        onError(settingsError(caught, 'No fue posible guardar los datos generales.'));
    } finally {
      if (!controller.signal.aborted) setSaving(false);
      if (mutationController.current === controller) mutationController.current = null;
    }
  }

  return (
    <Card className="admin-form-card">
      <form className="page-stack" onSubmit={submit}>
        <div className="admin-form-grid">
          <FormField label="Nombre de la organización" htmlFor="organization-name">
            <TextInput
              id="organization-name"
              maxLength={160}
              value={name}
              disabled={disabled}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </FormField>
          <FormField
            label="Identificador"
            htmlFor="organization-slug"
            hint="El identificador permanece fijo en V1."
          >
            <TextInput id="organization-slug" value={organization.slug} disabled readOnly />
          </FormField>
          <FormField
            label="Zona horaria"
            htmlFor="organization-timezone"
            hint="Ejemplo: America/Bogota. Los instantes históricos se conservan en UTC."
          >
            <TextInput
              id="organization-timezone"
              maxLength={80}
              value={timezone}
              disabled={disabled}
              onChange={(event) => setTimezone(event.target.value)}
              required
            />
          </FormField>
          <FormField label="Idioma y formato" htmlFor="organization-locale">
            <TextInput
              id="organization-locale"
              maxLength={20}
              value={locale}
              disabled={disabled}
              onChange={(event) => setLocale(event.target.value)}
              required
            />
          </FormField>
        </div>
        {!disabled ? (
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        ) : null}
      </form>
    </Card>
  );
}

// Commercial defaults affect only future documents and never expose the invoice sequence counter.
function CommercialSettingsForm({
  settings,
  disabled,
  onSaved,
  onError,
}: {
  settings: CommercialSettingsResponse;
  disabled: boolean;
  onSaved: (settings: CommercialSettingsResponse) => void;
} & FormFeedback) {
  const [currencyCode, setCurrencyCode] = useState(settings.currencyCode);
  const [invoicePrefix, setInvoicePrefix] = useState(settings.invoicePrefix);
  const [saving, setSaving] = useState(false);
  const mutationController = useRef<AbortController | null>(null);

  useEffect(() => () => mutationController.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    onError('');
    mutationController.current?.abort();
    const controller = new AbortController();
    mutationController.current = controller;
    try {
      onSaved(
        await adminApi.updateCommercialSettings({ currencyCode, invoicePrefix }, controller.signal),
      );
    } catch (caught) {
      if (!controller.signal.aborted)
        onError(settingsError(caught, 'No fue posible guardar las preferencias comerciales.'));
    } finally {
      if (!controller.signal.aborted) setSaving(false);
      if (mutationController.current === controller) mutationController.current = null;
    }
  }

  return (
    <Card className="admin-form-card">
      <form className="page-stack" onSubmit={submit}>
        <p className="admin-note">
          Estos valores se aplican a nuevas ventas y facturas. Los documentos históricos conservan
          sus importes, moneda y numeración originales.
        </p>
        <div className="admin-form-grid">
          <FormField
            label="Moneda predeterminada"
            htmlFor="commercial-currency"
            hint="Código de tres letras, por ejemplo COP o USD."
          >
            <TextInput
              id="commercial-currency"
              maxLength={3}
              value={currencyCode}
              disabled={disabled}
              onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())}
              required
            />
          </FormField>
          <FormField
            label="Prefijo de factura"
            htmlFor="invoice-prefix"
            hint="Solo aplica a facturas futuras. La secuencia actual continúa sin renumerar documentos."
          >
            <TextInput
              id="invoice-prefix"
              maxLength={16}
              value={invoicePrefix}
              disabled={disabled}
              onChange={(event) => setInvoicePrefix(event.target.value.toUpperCase())}
              required
            />
          </FormField>
        </div>
        {!disabled ? (
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        ) : null}
      </form>
    </Card>
  );
}

// Location edits use existing model fields and preserve history through reversible suspension.
function LocationsSettings({
  locations,
  canUpdate,
  onRefresh,
  onNotice,
  onError,
}: {
  locations: LocationResponse[];
  canUpdate: boolean;
  onRefresh: (signal?: AbortSignal) => Promise<void>;
  onNotice: (message: string) => void;
} & FormFeedback) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<LocationResponse | null>(null);
  const [editingLocation, setEditingLocation] = useState<LocationResponse | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const mutationController = useRef<AbortController | null>(null);

  useEffect(() => () => mutationController.current?.abort(), []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    onError('');
    mutationController.current?.abort();
    const controller = new AbortController();
    mutationController.current = controller;
    try {
      await adminApi.createLocation({ name, address, city }, controller.signal);
      setName('');
      setAddress('');
      setCity('');
      await onRefresh(controller.signal);
      onNotice('La sede quedó creada.');
    } catch (caught) {
      if (!controller.signal.aborted)
        onError(settingsError(caught, 'No fue posible crear la sede.'));
    } finally {
      if (!controller.signal.aborted) setSaving(false);
      if (mutationController.current === controller) mutationController.current = null;
    }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingLocation) return;
    setSaving(true);
    onError('');
    mutationController.current?.abort();
    const controller = new AbortController();
    mutationController.current = controller;
    try {
      await adminApi.updateLocation(
        editingLocation.id,
        { name: editName, address: editAddress, city: editCity },
        controller.signal,
      );
      await onRefresh(controller.signal);
      onNotice('Los datos de la sede quedaron guardados.');
      setEditingLocation(null);
    } catch (caught) {
      if (!controller.signal.aborted)
        onError(settingsError(caught, 'No fue posible actualizar la sede.'));
    } finally {
      if (!controller.signal.aborted) setSaving(false);
      if (mutationController.current === controller) mutationController.current = null;
    }
  }

  async function setStatus(location: LocationResponse, action: 'activate' | 'deactivate') {
    setSaving(true);
    onError('');
    mutationController.current?.abort();
    const controller = new AbortController();
    mutationController.current = controller;
    try {
      await adminApi.setLocationStatus(location.id, action, controller.signal);
      await onRefresh(controller.signal);
      onNotice(
        action === 'deactivate'
          ? 'La sede quedó inactiva. Su historial se conserva.'
          : 'La sede quedó activa.',
      );
      setPendingLocation(null);
    } catch (caught) {
      if (!controller.signal.aborted)
        onError(settingsError(caught, 'No fue posible cambiar el estado de la sede.'));
    } finally {
      if (!controller.signal.aborted) setSaving(false);
      if (mutationController.current === controller) mutationController.current = null;
    }
  }

  return (
    <div className="page-stack admin-settings-section">
      {canUpdate ? (
        <Card className="admin-form-card">
          <h2>Agregar sede</h2>
          <form className="page-stack" onSubmit={create}>
            <div className="admin-form-grid">
              <FormField label="Nombre" htmlFor="new-location-name">
                <TextInput
                  id="new-location-name"
                  maxLength={160}
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </FormField>
              <FormField label="Dirección" htmlFor="new-location-address">
                <TextInput
                  id="new-location-address"
                  maxLength={300}
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                />
              </FormField>
              <FormField label="Ciudad" htmlFor="new-location-city">
                <TextInput
                  id="new-location-city"
                  maxLength={160}
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                />
              </FormField>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Crear sede'}
            </Button>
          </form>
        </Card>
      ) : null}
      <Card className="admin-list-card">
        <div className="admin-section-heading">
          <h2>Sedes de la organización</h2>
          <span>{locations.length} en total</span>
        </div>
        {locations.length ? (
          <div className="admin-location-list">
            {locations.map((location) => (
              <article className="admin-location-row" key={location.id}>
                <div className="admin-location-copy">
                  <strong>{location.name}</strong>
                  <span>
                    {[location.address, location.city].filter(Boolean).join(' · ') ||
                      'Sin dirección registrada'}
                  </span>
                </div>
                <Badge tone={location.status === 'ACTIVE' ? 'success' : 'warning'}>
                  {location.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
                </Badge>
                {canUpdate ? (
                  <div className="admin-actions">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditingLocation(location);
                        setEditName(location.name);
                        setEditAddress(location.address ?? '');
                        setEditCity(location.city ?? '');
                      }}
                    >
                      Editar
                    </Button>
                    {location.status === 'ACTIVE' ? (
                      <Button variant="danger" onClick={() => setPendingLocation(location)}>
                        Inactivar
                      </Button>
                    ) : location.status === 'SUSPENDED' ? (
                      <Button
                        variant="secondary"
                        onClick={() => void setStatus(location, 'activate')}
                      >
                        Reactivar
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="admin-empty-copy">Todavía no hay sedes registradas.</p>
        )}
      </Card>
      <Modal
        open={editingLocation !== null}
        title="Editar sede"
        onClose={() => setEditingLocation(null)}
      >
        <form className="page-stack" onSubmit={saveEdit}>
          <FormField label="Nombre" htmlFor="edit-location-name">
            <TextInput
              id="edit-location-name"
              maxLength={160}
              required
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
            />
          </FormField>
          <FormField label="Dirección" htmlFor="edit-location-address">
            <TextInput
              id="edit-location-address"
              maxLength={300}
              value={editAddress}
              onChange={(event) => setEditAddress(event.target.value)}
            />
          </FormField>
          <FormField label="Ciudad" htmlFor="edit-location-city">
            <TextInput
              id="edit-location-city"
              maxLength={160}
              value={editCity}
              onChange={(event) => setEditCity(event.target.value)}
            />
          </FormField>
          <div className="admin-actions">
            <Button type="submit" disabled={saving}>
              Guardar sede
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditingLocation(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={pendingLocation !== null}
        title="Inactivar sede"
        description="La sede dejará de estar disponible para nuevas operaciones. El historial existente se conservará."
        onClose={() => setPendingLocation(null)}
      >
        <div className="admin-actions">
          <Button
            type="button"
            variant="danger"
            disabled={saving || !pendingLocation}
            onClick={() => pendingLocation && void setStatus(pendingLocation, 'deactivate')}
          >
            Confirmar inactivación
          </Button>
          <Button type="button" variant="ghost" onClick={() => setPendingLocation(null)}>
            Volver
          </Button>
        </div>
      </Modal>
    </div>
  );
}
