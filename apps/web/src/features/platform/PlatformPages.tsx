import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { PageHeader } from '../../components/ui/PageHeader';
import { TextInput } from '../../components/ui/TextInput';
import { EasyvetIcon } from '../../components/icons/EasyvetIcon';
import { PaginationControls } from '../shared/ResourceFeedback';
import type {
  PlatformAdminAccount,
  PlatformActivityQuery,
  PlatformOrganization,
  PlatformSubscriptionEntry,
  PlatformSubscriptionPlan,
} from '@veterinary-saas/contracts';
import { platformApi } from './platformApi';
import { useAuth } from '../../contexts/useAuth';

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(value));
}

function dateInputValue(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

function subscriptionStatusLabel(status: string) {
  return (
    {
      TRIAL: 'Prueba',
      ACTIVE: 'Activa',
      PAST_DUE: 'Pendiente de pago',
      CANCELED: 'Cancelada',
    }[status] ?? status
  );
}

function priceLabel(price: string | null, currencyCode = 'COP') {
  if (price === null) return 'Precio por definir';
  if (Number(price) === 0) return 'Gratis';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(Number(price));
}

const membershipRoleLabels: Record<string, string> = {
  OWNER: 'Propietario/a',
  ADMIN: 'Administrador/a',
  VETERINARIAN: 'Veterinario/a',
  ASSISTANT: 'Auxiliar',
  RECEPTION: 'Recepción',
  GROOMER: 'Peluquería',
  CASHIER: 'Caja',
};

function OrganizationStatus({ status }: { status: PlatformOrganization['status'] }) {
  const label =
    status === 'ACTIVE' ? 'Activa' : status === 'SUSPENDED' ? 'Suspendida' : 'Archivada';
  return (
    <span className={`platform-status platform-status--${status.toLowerCase()}`}>{label}</span>
  );
}

export function PlatformOverviewPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof platformApi.overview>> | null>(null);
  const [databasePosture, setDatabasePosture] = useState<Awaited<
    ReturnType<typeof platformApi.databasePosture>
  > | null>(null);
  const [error, setError] = useState(false);
  const [databasePostureError, setDatabasePostureError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    platformApi
      .overview(controller.signal)
      .then((result) => setData(result))
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    platformApi
      .databasePosture(controller.signal)
      .then((result) => setDatabasePosture(result))
      .catch(() => {
        if (!controller.signal.aborted) setDatabasePostureError(true);
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="platform-page">
      <PageHeader
        eyebrow="Easyvet · plataforma"
        title="Una vista clara de toda la plataforma."
        description="Gestiona el estado de las clínicas y revisa actividad administrativa, sin entrar a datos clínicos."
        action={
          <Link className="button button--secondary" to="/plataforma/clinicas">
            Ver clínicas
          </Link>
        }
      />
      {error ? (
        <Alert tone="error">No fue posible cargar el resumen de la plataforma.</Alert>
      ) : null}
      <section className="platform-stat-grid" aria-label="Indicadores de la plataforma">
        <Card className="platform-stat">
          <span className="platform-stat__label">Clínicas registradas</span>
          <strong>{data?.organizations.total ?? '—'}</strong>
          <small>{data?.organizations.active ?? '—'} activas</small>
        </Card>
        <Card className="platform-stat">
          <span className="platform-stat__label">Clínicas suspendidas</span>
          <strong>{data?.organizations.suspended ?? '—'}</strong>
          <small>Sin acceso operativo hasta reactivación</small>
        </Card>
        <Card className="platform-stat">
          <span className="platform-stat__label">Cuentas de usuario</span>
          <strong>{data?.users.total ?? '—'}</strong>
          <small>{data?.users.active ?? '—'} activas</small>
        </Card>
        <Card className="platform-stat">
          <span className="platform-stat__label">Accesos a clínicas</span>
          <strong>{data?.memberships.active ?? '—'}</strong>
          <small>Vínculos de equipo activos</small>
        </Card>
      </section>

      <Card
        className="platform-panel platform-database-posture"
        aria-labelledby="database-posture-title"
      >
        <div className="platform-panel__heading">
          <div>
            <p className="section-kicker">Seguridad de infraestructura</p>
            <h2 id="database-posture-title">Rol de base de datos de la aplicación</h2>
          </div>
          {databasePosture ? (
            <span
              className={`platform-status ${databasePosture.bypassesRowLevelSecurity || databasePosture.superuser ? 'platform-status--suspended' : 'platform-status--active'}`}
            >
              {databasePosture.bypassesRowLevelSecurity || databasePosture.superuser
                ? 'Puede omitir RLS'
                : 'No omite RLS'}
            </span>
          ) : null}
        </div>
        {databasePostureError ? (
          <p role="status">No fue posible consultar el rol de base de datos del runtime.</p>
        ) : databasePosture ? (
          <>
            <p>
              Rol conectado: <strong>{databasePosture.role}</strong>
            </p>
            <p className="platform-privacy-note">
              Este dato describe el rol del runtime; no verifica las políticas RLS ni el aislamiento
              entre clínicas.
            </p>
          </>
        ) : (
          <p role="status">Consultando el rol del runtime…</p>
        )}
      </Card>

      <Card className="platform-panel">
        <div className="platform-panel__heading">
          <div>
            <p className="section-kicker">Altas recientes</p>
            <h2>Clínicas que se unieron a Easyvet</h2>
          </div>
          <Link to="/plataforma/clinicas">
            Ver todas <EasyvetIcon name="arrow-up-right" size={15} />
          </Link>
        </div>
        {data?.recentOrganizations.length ? (
          <div className="platform-recent-list">
            {data.recentOrganizations.map((organization) => (
              <div className="platform-recent-row" key={organization.id}>
                <span className="platform-recent-row__identity">
                  <strong>{organization.name}</strong>
                  <small>
                    /{organization.slug} · {organization.memberCount} integrantes
                  </small>
                </span>
                <span className="platform-recent-row__meta">
                  <OrganizationStatus status={organization.status} />
                  <small>{dateLabel(organization.createdAt)}</small>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="platform-empty">
            {error
              ? 'Resumen no disponible.'
              : data
                ? 'Aún no hay clínicas registradas.'
                : 'Cargando actividad…'}
          </p>
        )}
      </Card>
      <p className="platform-privacy-note">
        Esta consola muestra metadatos administrativos. No consulta pacientes ni historias clínicas.
      </p>
    </div>
  );
}

export function PlatformOrganizationsPage() {
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [selected, setSelected] = useState<PlatformOrganization | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    platformApi
      .organizations({ search, status, page, pageSize }, controller.signal)
      .then((result) => {
        setOrganizations(result.data);
        setTotal(result.total);
        const nextPageCount = Math.max(1, Math.ceil(result.total / pageSize));
        if (page > nextPageCount) setPage(nextPageCount);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('No fue posible cargar las clínicas.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [search, status, page, pageSize, reloadKey]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  async function changeStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || reason.trim().length < 5) return;
    setSaving(true);
    setError('');
    try {
      await platformApi.updateOrganizationStatus(selected.id, {
        status: selected.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
        reason: reason.trim(),
      });
      setSelected(null);
      setReason('');
      setReloadKey((value) => value + 1);
    } catch {
      setError('No fue posible actualizar la clínica. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  const nextStatus = selected?.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
  const nextAction = nextStatus === 'SUSPENDED' ? 'suspender' : 'reactivar';

  return (
    <div className="platform-page">
      <PageHeader
        eyebrow="Administración · clínicas"
        title="Organizaciones"
        description="Consulta datos básicos de cada clínica y controla su acceso a la plataforma."
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {selected ? (
        <Card
          as="section"
          className="platform-confirm-card"
          aria-labelledby="platform-confirm-title"
        >
          <form onSubmit={(event) => void changeStatus(event)}>
            <div className="platform-confirm-card__copy">
              <p className="section-kicker">Confirmar cambio de acceso</p>
              <h2 id="platform-confirm-title">
                ¿Quieres {nextAction} {selected.name}?
              </h2>
              <p>
                La acción quedará en la auditoría de plataforma. La suspensión bloquea el acceso de
                los integrantes de esta clínica; no elimina sus datos.
              </p>
            </div>
            <FormField
              label="Motivo"
              htmlFor="platform-status-reason"
              hint="Se guardará en el registro de auditoría."
            >
              <TextInput
                id="platform-status-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={5}
                maxLength={500}
                required
              />
            </FormField>
            <div className="platform-confirm-card__actions">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setSelected(null)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                variant={nextStatus === 'SUSPENDED' ? 'danger' : 'primary'}
                type="submit"
                disabled={saving || reason.trim().length < 5}
              >
                {saving ? 'Guardando…' : `Confirmar y ${nextAction}`}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
      <Card className="platform-panel">
        <div className="platform-toolbar">
          <FormField label="Buscar clínica" htmlFor="platform-org-search">
            <TextInput
              id="platform-org-search"
              type="search"
              placeholder="Nombre o identificador"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </FormField>
          <FormField label="Estado" htmlFor="platform-org-status">
            <select
              id="platform-org-status"
              className="input"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Todos</option>
              <option value="ACTIVE">Activas</option>
              <option value="SUSPENDED">Suspendidas</option>
              <option value="ARCHIVED">Archivadas</option>
            </select>
          </FormField>
          <p className="platform-result-count">
            {total} {total === 1 ? 'clínica' : 'clínicas'}
          </p>
        </div>
        <div className="platform-table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th scope="col">Clínica</th>
                <th scope="col">Estado</th>
                <th scope="col">Equipo</th>
                <th scope="col">Registro</th>
                <th scope="col">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((organization) => (
                <tr key={organization.id}>
                  <td>
                    <Link
                      className="platform-organization-link"
                      to={`/plataforma/clinicas/${organization.id}`}
                    >
                      <strong>{organization.name}</strong>
                    </Link>
                    <small>/{organization.slug}</small>
                  </td>
                  <td>
                    <OrganizationStatus status={organization.status} />
                  </td>
                  <td>{organization.memberCount}</td>
                  <td>{dateLabel(organization.createdAt)}</td>
                  <td className="platform-table__action">
                    {organization.status !== 'ARCHIVED' ? (
                      <Button
                        variant={organization.status === 'ACTIVE' ? 'ghost' : 'secondary'}
                        type="button"
                        onClick={() => {
                          setSelected(organization);
                          setReason('');
                        }}
                      >
                        {organization.status === 'ACTIVE' ? 'Suspender' : 'Reactivar'}
                      </Button>
                    ) : (
                      <span className="platform-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!organizations.length ? (
                <tr>
                  <td colSpan={5} className="platform-table__empty">
                    {loading
                      ? 'Cargando clínicas…'
                      : 'No hay clínicas que coincidan con estos filtros.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <PaginationControls page={page} totalPages={pageCount} onChange={setPage} />
        <p className="platform-table__note">
          Mostrando {organizations.length} de {total} clínicas. La consola no presenta información
          clínica.
        </p>
      </Card>
    </div>
  );
}

export function PlatformOrganizationDetailPage() {
  const { organizationId = '' } = useParams();
  const [data, setData] = useState<Awaited<
    ReturnType<typeof platformApi.organizationDetail>
  > | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(false);
    platformApi
      .organizationDetail(organizationId, controller.signal)
      .then(setData)
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [organizationId]);

  return (
    <div className="platform-page">
      <Link className="platform-back-link" to="/plataforma/clinicas">
        <EasyvetIcon name="arrow-left" size={16} />
        <span>Volver a clínicas</span>
      </Link>
      {error ? (
        <>
          <PageHeader
            eyebrow="Administración · clínicas"
            title="Clínica no disponible"
            description="No fue posible cargar esta clínica o no tienes acceso a su información administrativa."
          />
          <Alert tone="error" role="alert">
            No fue posible cargar esta clínica o no tienes acceso.
          </Alert>
        </>
      ) : null}
      {!data && !error ? <p className="platform-empty">Cargando clínica…</p> : null}
      {data ? (
        <>
          <PageHeader
            eyebrow={`Clínica · /${data.slug}`}
            title={data.name}
            description="Ficha administrativa. Esta vista no consulta pacientes ni información clínica."
            action={<OrganizationStatus status={data.status} />}
          />
          <section className="platform-stat-grid" aria-label="Resumen administrativo de la clínica">
            <Card className="platform-stat">
              <span className="platform-stat__label">Integrantes</span>
              <strong>{data.memberships.total}</strong>
              <small>{data.memberships.active} con acceso activo</small>
            </Card>
            <Card className="platform-stat">
              <span className="platform-stat__label">Invitaciones</span>
              <strong>{data.memberships.invited}</strong>
              <small>{data.memberships.suspended} accesos suspendidos</small>
            </Card>
            <Card className="platform-stat">
              <span className="platform-stat__label">Sedes</span>
              <strong>{data.locations.total}</strong>
              <small>Máximo 10 sedes listadas abajo</small>
            </Card>
            <Card className="platform-stat">
              <span className="platform-stat__label">Moneda y zona horaria</span>
              <strong>{data.currencyCode}</strong>
              <small>{data.timezone}</small>
            </Card>
          </section>

          <div className="platform-detail-grid">
            <Card className="platform-panel">
              <div className="platform-panel__heading">
                <div>
                  <p className="section-kicker">Operación</p>
                  <h2>Sedes registradas</h2>
                </div>
              </div>
              {data.locations.data.length ? (
                <div className="platform-detail-list">
                  {data.locations.data.map((location) => (
                    <div className="platform-detail-row" key={location.id}>
                      <span>
                        <strong>{location.name}</strong>
                        <small>{location.city || 'Ciudad no registrada'}</small>
                      </span>
                      <span
                        className={`platform-status platform-status--${location.status.toLowerCase()}`}
                      >
                        {location.status === 'ACTIVE'
                          ? 'Activa'
                          : location.status === 'SUSPENDED'
                            ? 'Suspendida'
                            : 'Archivada'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="platform-empty">Esta clínica aún no registra sedes.</p>
              )}
              {data.locations.total > data.locations.data.length ? (
                <p className="platform-table__note">
                  Se muestran 10 de {data.locations.total} sedes.
                </p>
              ) : null}
            </Card>
            <Card className="platform-panel">
              <div className="platform-panel__heading">
                <div>
                  <p className="section-kicker">Accesos agregados</p>
                  <h2>Integrantes por rol</h2>
                </div>
              </div>
              {data.memberships.byRole.length ? (
                <div className="platform-detail-list">
                  {data.memberships.byRole.map(({ role, count }) => (
                    <div className="platform-detail-row" key={role}>
                      <strong>{membershipRoleLabels[role] ?? role.replaceAll('_', ' ')}</strong>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="platform-empty">Sin integrantes registrados.</p>
              )}
              <p className="platform-table__note">
                Solo se muestran conteos; no se exponen cuentas personales.
              </p>
            </Card>
          </div>

          <Card className="platform-panel">
            <div className="platform-panel__heading">
              <div>
                <p className="section-kicker">Seguridad</p>
                <h2>Actividad administrativa reciente</h2>
              </div>
            </div>
            {data.recentAdministrativeActivity.length ? (
              <div className="platform-detail-list">
                {data.recentAdministrativeActivity.map((event) => (
                  <div className="platform-detail-row" key={event.id}>
                    <span>
                      <strong>
                        Estado: {event.from ?? '—'} → {event.to ?? '—'}
                      </strong>
                      <small>
                        {event.reason || 'Sin motivo registrado'} · {event.actorEmail}
                      </small>
                    </span>
                    <small>{dateLabel(event.createdAt)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="platform-empty">No hay cambios administrativos registrados.</p>
            )}
            <p className="platform-table__note">
              La actividad está limitada a acciones de plataforma; no incluye auditoría clínica.
            </p>
          </Card>
          <p className="platform-privacy-note">
            Registrada el {dateLabel(data.createdAt)} · Última actualización{' '}
            {dateLabel(data.updatedAt)} · Idioma {data.locale}.
          </p>
        </>
      ) : null}
    </div>
  );
}

export function PlatformActivityPage() {
  const [result, setResult] = useState<Awaited<ReturnType<typeof platformApi.activity>> | null>(
    null,
  );
  const [search, setSearch] = useState('');
  const [action, setAction] = useState<NonNullable<PlatformActivityQuery['action']>>('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    platformApi
      .activity({ search, action, from, to, page, pageSize }, controller.signal)
      .then(setResult)
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [search, action, from, to, page, pageSize]);

  const events = result?.data ?? [];
  const pageCount = Math.max(1, result?.pageCount ?? 0);

  return (
    <div className="platform-page">
      <PageHeader
        eyebrow="Administración · seguridad"
        title="Auditoría de plataforma"
        description="Cambios administrativos recientes, con quién los realizó y el motivo registrado."
      />
      {error ? <Alert tone="error">No fue posible cargar la auditoría.</Alert> : null}
      <Card className="platform-panel">
        <div className="platform-activity-filters" aria-label="Filtros de auditoría">
          <FormField label="Buscar por correo o clínica" htmlFor="activity-search">
            <TextInput
              id="activity-search"
              type="search"
              maxLength={160}
              placeholder="Correo o nombre de clínica"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </FormField>
          <FormField label="Tipo de acción" htmlFor="activity-action">
            <select
              className="input"
              id="activity-action"
              value={action}
              onChange={(event) => {
                setAction(event.target.value as NonNullable<PlatformActivityQuery['action']>);
                setPage(1);
              }}
            >
              <option value="ALL">Todas las acciones</option>
              <option value="ORGANIZATION_STATUS_CHANGED">Estado de clínica</option>
              <option value="PLATFORM_ADMIN_BOOTSTRAPPED">Super admin inicial</option>
              <option value="ORGANIZATION_SUBSCRIPTION_CHANGED">Suscripción</option>
              <option value="PLATFORM_ADMIN_ACCOUNT_CREATED">Cuenta super admin creada</option>
              <option value="PLATFORM_ADMIN_ACCOUNT_STATUS_CHANGED">
                Estado de cuenta super admin
              </option>
            </select>
          </FormField>
          <FormField label="Desde" htmlFor="activity-from">
            <TextInput
              id="activity-from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
            />
          </FormField>
          <FormField label="Hasta" htmlFor="activity-to">
            <TextInput
              id="activity-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
            />
          </FormField>
        </div>
        <div className="platform-activity-summary" aria-live="polite">
          {loading
            ? 'Cargando actividad…'
            : `${result?.total ?? 0} ${result?.total === 1 ? 'resultado' : 'resultados'}`}
        </div>
        {events.length ? (
          <div className="platform-activity-list">
            {events.map((event) => {
              const reason =
                typeof event.metadata?.reason === 'string' ? event.metadata.reason : 'Sin motivo';
              return (
                <article className="platform-activity-row" key={event.id}>
                  <span className="platform-activity-row__marker" aria-hidden="true">
                    <EasyvetIcon name="arrow-up-right" size={16} />
                  </span>
                  <div className="platform-activity-row__content">
                    <strong>{platformActivityTitle(event)}</strong>
                    <p>
                      {event.action === 'PLATFORM_ADMIN_BOOTSTRAPPED'
                        ? event.actorEmail
                        : event.action === 'PLATFORM_ADMIN_ACCOUNT_CREATED'
                          ? `${typeof event.metadata?.email === 'string' ? event.metadata.email : 'Cuenta'} · ${reason}`
                          : reason}
                    </p>
                    <small>
                      Por {event.actorEmail} · {dateLabel(event.createdAt)}
                    </small>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="platform-empty">
            {loading
              ? 'Buscando actividad…'
              : error
                ? 'Auditoría no disponible.'
                : 'No hay actividad que coincida con estos filtros.'}
          </p>
        )}
        <div className="platform-activity-pagination" aria-label="Paginación de auditoría">
          <FormField label="Resultados por página" htmlFor="activity-page-size">
            <select
              className="input"
              id="activity-page-size"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value) as 10 | 20 | 50);
                setPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </FormField>
          <div className="platform-activity-pagination__controls">
            <Button
              variant="secondary"
              type="button"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </Button>
            <span aria-live="polite">
              Página {page} de {pageCount}
            </span>
            <Button
              variant="secondary"
              type="button"
              disabled={loading || page >= pageCount}
              onClick={() => setPage((current) => current + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function platformActivityTitle(
  event: Awaited<ReturnType<typeof platformApi.activity>>['data'][number],
) {
  const from = typeof event.metadata?.from === 'string' ? event.metadata.from : '';
  const to = typeof event.metadata?.to === 'string' ? event.metadata.to : '';
  switch (event.action) {
    case 'PLATFORM_ADMIN_BOOTSTRAPPED':
      return 'Cuenta inicial de super admin configurada';
    case 'PLATFORM_ADMIN_ACCOUNT_CREATED':
      return 'Nueva cuenta de super admin creada';
    case 'PLATFORM_ADMIN_ACCOUNT_STATUS_CHANGED':
      return `Acceso de super admin · ${from} → ${to}`;
    case 'ORGANIZATION_SUBSCRIPTION_CHANGED':
      return `Suscripción de clínica · ${from} → ${to}`;
    default:
      return `${event.organizationName ?? 'Clínica'} · ${from} → ${to}`;
  }
}

export function PlatformAccountsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<PlatformAdminAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [email, setEmail] = useState('');
  const [creationReason, setCreationReason] = useState('');
  const [createdCredential, setCreatedCredential] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<PlatformAdminAccount | null>(null);
  const [nextStatus, setNextStatus] = useState<'ACTIVE' | 'SUSPENDED'>('SUSPENDED');
  const [statusReason, setStatusReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    platformApi
      .platformAccounts({ search, page, pageSize }, controller.signal)
      .then((result) => {
        setAccounts(result.data);
        setTotal(result.total);
        const nextPageCount = Math.max(1, Math.ceil(result.total / pageSize));
        if (page > nextPageCount) setPage(nextPageCount);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('No fue posible cargar las cuentas de plataforma.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [search, page, pageSize, reloadKey]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setCreatedCredential(null);
    try {
      const result = await platformApi.createPlatformAccount({
        email,
        reason: creationReason,
      });
      setCreatedCredential({ email: result.account.email, password: result.temporaryPassword });
      setEmail('');
      setCreationReason('');
      setPage(1);
      setReloadKey((value) => value + 1);
    } catch {
      setError('No fue posible crear la cuenta. Verifica que el correo no esté registrado.');
    } finally {
      setSaving(false);
    }
  }

  function beginStatusChange(account: PlatformAdminAccount) {
    setSelectedAccount(account);
    setNextStatus(account.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE');
    setStatusReason('');
    setError('');
  }

  async function saveStatusChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAccount) return;
    setSaving(true);
    setError('');
    try {
      await platformApi.updatePlatformAccountStatus(selectedAccount.id, {
        status: nextStatus,
        reason: statusReason,
      });
      setSelectedAccount(null);
      setReloadKey((value) => value + 1);
    } catch {
      setError(
        nextStatus === 'SUSPENDED'
          ? 'No se pudo suspender. No puedes suspender tu propia cuenta ni la última cuenta activa.'
          : 'No fue posible reactivar esta cuenta.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="platform-page">
      <PageHeader
        eyebrow="Administración · equipo Easyvet"
        title="Cuentas de plataforma"
        description="Administra quién puede acceder a la consola de super admin. Estas cuentas no reciben membresías de clínicas."
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {createdCredential ? (
        <Alert tone="success">
          <div className="platform-credential-result" role="status">
            <div>
              <strong>Cuenta creada para {createdCredential.email}</strong>
              <p>
                Entrega esta clave temporal por un canal seguro. Se solicitará cambiarla al
                ingresar.
              </p>
              <code>{createdCredential.password}</code>
            </div>
            <Button variant="ghost" type="button" onClick={() => setCreatedCredential(null)}>
              Ocultar clave
            </Button>
          </div>
        </Alert>
      ) : null}

      <Card
        as="section"
        className="platform-confirm-card"
        aria-labelledby="platform-account-create"
      >
        <form onSubmit={(event) => void createAccount(event)}>
          <div className="platform-confirm-card__copy">
            <p className="section-kicker">Acceso interno</p>
            <h2 id="platform-account-create">Crear cuenta de super admin</h2>
            <p>La clave temporal aparece una sola vez y no se guarda en la auditoría.</p>
          </div>
          <div className="platform-account-form">
            <FormField label="Correo" htmlFor="platform-account-email">
              <TextInput
                id="platform-account-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={320}
                required
              />
            </FormField>
            <FormField
              label="Motivo de creación"
              htmlFor="platform-account-reason"
              hint="Quedará registrado en la auditoría."
            >
              <TextInput
                id="platform-account-reason"
                value={creationReason}
                onChange={(event) => setCreationReason(event.target.value)}
                minLength={5}
                maxLength={500}
                required
              />
            </FormField>
          </div>
          <div className="platform-confirm-card__actions">
            <Button
              type="submit"
              disabled={saving || !email.trim() || creationReason.trim().length < 5}
            >
              {saving ? 'Creando…' : 'Crear cuenta'}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="platform-panel">
        <div className="platform-toolbar">
          <FormField label="Buscar por correo" htmlFor="platform-account-search">
            <TextInput
              id="platform-account-search"
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="admin@easyvet.co"
            />
          </FormField>
          <p className="platform-result-count">{total} cuentas</p>
        </div>
        <div className="platform-table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th scope="col">Cuenta</th>
                <th scope="col">Estado</th>
                <th scope="col">Creada</th>
                <th scope="col">Acceso</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td>
                    <strong>{account.email}</strong>
                    {account.id === user?.id ? <small>Tu cuenta</small> : null}
                  </td>
                  <td>
                    <span
                      className={`platform-status platform-status--${account.status.toLowerCase()}`}
                    >
                      {account.status === 'ACTIVE'
                        ? 'Activa'
                        : account.status === 'SUSPENDED'
                          ? 'Suspendida'
                          : 'Pendiente de verificación'}
                    </span>
                  </td>
                  <td>{dateLabel(account.createdAt)}</td>
                  <td>
                    {account.status !== 'PENDING_VERIFICATION' && account.id !== user?.id ? (
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => beginStatusChange(account)}
                      >
                        {account.status === 'ACTIVE' ? 'Suspender' : 'Reactivar'}
                      </Button>
                    ) : account.id === user?.id ? (
                      <span className="platform-table__note">No editable aquí</span>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!accounts.length ? (
                <tr>
                  <td colSpan={4} className="platform-table__empty">
                    {loading
                      ? 'Cargando cuentas…'
                      : error
                        ? 'Cuentas no disponibles.'
                        : 'No hay cuentas que coincidan con la búsqueda.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <PaginationControls page={page} totalPages={pageCount} onChange={setPage} />
        <p className="platform-table__note">
          Mostrando {accounts.length} de {total} cuentas de super admin.
        </p>
      </Card>

      {selectedAccount ? (
        <Card
          as="section"
          className="platform-confirm-card"
          aria-labelledby="platform-account-status"
        >
          <form onSubmit={(event) => void saveStatusChange(event)}>
            <div className="platform-confirm-card__copy">
              <p className="section-kicker">Confirmar cambio · {selectedAccount.email}</p>
              <h2 id="platform-account-status">
                {nextStatus === 'SUSPENDED' ? 'Suspender acceso' : 'Reactivar acceso'}
              </h2>
              <p>
                {nextStatus === 'SUSPENDED'
                  ? 'Se cerrarán las sesiones abiertas de esta cuenta.'
                  : 'La cuenta podrá volver a iniciar sesión con su contraseña actual.'}
              </p>
            </div>
            <FormField
              label="Motivo del cambio"
              htmlFor="platform-account-status-reason"
              hint="Quedará registrado en la auditoría."
            >
              <TextInput
                id="platform-account-status-reason"
                value={statusReason}
                onChange={(event) => setStatusReason(event.target.value)}
                minLength={5}
                maxLength={500}
                required
              />
            </FormField>
            <div className="platform-confirm-card__actions">
              <Button variant="secondary" type="button" onClick={() => setSelectedAccount(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || statusReason.trim().length < 5}>
                {saving ? 'Guardando…' : 'Confirmar cambio'}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
      <p className="platform-privacy-note">
        Las cuentas se administran por separado de las clínicas; esta sección no otorga acceso a sus
        datos.
      </p>
    </div>
  );
}

export function PlatformSubscriptionsPage() {
  const [plans, setPlans] = useState<PlatformSubscriptionPlan[]>([]);
  const [organizations, setOrganizations] = useState<PlatformSubscriptionEntry[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<PlatformSubscriptionEntry | null>(null);
  const [planCode, setPlanCode] = useState('ESSENTIAL');
  const [status, setStatus] = useState('ACTIVE');
  const [interval, setInterval] = useState('NONE');
  const [startsAt, setStartsAt] = useState(dateInputValue(new Date().toISOString()));
  const [trialEndsAt, setTrialEndsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    Promise.all([
      platformApi.subscriptionPlans(controller.signal),
      platformApi.subscriptions({ search, page, pageSize }, controller.signal),
    ])
      .then(([planResponse, subscriptionResponse]) => {
        setPlans(planResponse.data);
        setOrganizations(subscriptionResponse.data);
        setTotal(subscriptionResponse.total);
        const nextPageCount = Math.max(1, Math.ceil(subscriptionResponse.total / pageSize));
        if (page > nextPageCount) setPage(nextPageCount);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('No fue posible cargar planes y suscripciones.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [search, page, pageSize, reloadKey]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  function openAssignment(organization: PlatformSubscriptionEntry) {
    setSelected(organization);
    setPlanCode(organization.subscription?.planCode ?? 'ESSENTIAL');
    setStatus(organization.subscription?.status ?? 'ACTIVE');
    setInterval(organization.subscription?.interval ?? 'NONE');
    setStartsAt(
      dateInputValue(organization.subscription?.startsAt) ||
        dateInputValue(new Date().toISOString()),
    );
    setTrialEndsAt(dateInputValue(organization.subscription?.trialEndsAt));
    setEndsAt(dateInputValue(organization.subscription?.endsAt));
    setReason('');
    setError('');
  }

  function changePlan(nextPlanCode: string) {
    setPlanCode(nextPlanCode);
    if (nextPlanCode === 'ESSENTIAL') {
      setStatus('ACTIVE');
      setInterval('NONE');
      setTrialEndsAt('');
    } else {
      setInterval((current) => (current === 'NONE' ? 'MONTHLY' : current));
    }
  }

  async function saveAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || reason.trim().length < 5) return;
    setSaving(true);
    setError('');
    try {
      await platformApi.assignSubscription(selected.id, {
        planCode: planCode as 'ESSENTIAL' | 'GROWTH' | 'CLINIC_PRO',
        status: status as 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED',
        interval: interval as 'NONE' | 'MONTHLY' | 'ANNUAL',
        ...(startsAt ? { startsAt } : {}),
        ...(status === 'TRIAL' && trialEndsAt ? { trialEndsAt } : {}),
        ...(endsAt ? { endsAt } : {}),
        reason: reason.trim(),
      });
      setSelected(null);
      setReloadKey((value) => value + 1);
    } catch {
      setError('No fue posible guardar la suscripción. Revisa los datos e intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="platform-page">
      <PageHeader
        eyebrow="Administración · planes"
        title="Planes y suscripciones"
        description="Consulta los planes comerciales y registra manualmente el plan vigente de cada clínica."
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <section className="platform-plan-grid" aria-label="Catálogo de planes">
        {plans.map((plan) => (
          <Card className="platform-plan-card" key={plan.id}>
            <p className="section-kicker">{plan.eyebrow}</p>
            <h2>{plan.name}</h2>
            <p className="platform-plan-card__description">{plan.description}</p>
            <div className="platform-plan-card__price">
              <strong>{priceLabel(plan.monthlyPrice, plan.currencyCode)}</strong>
              <span>{plan.monthlyPrice === '0.00' ? 'sin tarjeta' : 'COP / mes'}</span>
            </div>
            {plan.monthlyPrice !== '0.00' ? (
              <p className="platform-table__note">
                Anual: {priceLabel(plan.annualPrice, plan.currencyCode)} ·{' '}
                {plan.annualDiscountPercent
                  ? `${plan.annualDiscountPercent}% de descuento`
                  : 'descuento por definir'}
              </p>
            ) : null}
            <ul className="platform-plan-card__features">
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </Card>
        ))}
        {!plans.length && !loading ? (
          <p className="platform-empty">No hay planes activos en el catálogo.</p>
        ) : null}
      </section>
      <p className="platform-privacy-note">
        La asignación es administrativa: no procesa pagos ni restringe el acceso por mora o
        cancelación. Los precios de pago siguen pendientes.
      </p>

      {selected ? (
        <Card
          as="section"
          className="platform-confirm-card"
          aria-labelledby="subscription-form-title"
        >
          <form onSubmit={(event) => void saveAssignment(event)}>
            <div className="platform-confirm-card__copy">
              <p className="section-kicker">Asignación manual · {selected.name}</p>
              <h2 id="subscription-form-title">Administrar suscripción</h2>
              <p>
                El cambio quedará registrado en la auditoría con tu motivo. No activa cobros
                automáticos.
              </p>
            </div>
            <div className="platform-subscription-form-grid">
              <FormField label="Plan" htmlFor="platform-subscription-plan">
                <select
                  id="platform-subscription-plan"
                  className="input"
                  value={planCode}
                  onChange={(event) => changePlan(event.target.value)}
                >
                  {plans.map((plan) => (
                    <option value={plan.code} key={plan.code}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Estado" htmlFor="platform-subscription-status">
                <select
                  id="platform-subscription-status"
                  className="input"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  {planCode === 'ESSENTIAL' ? (
                    <option value="ACTIVE">Activa</option>
                  ) : (
                    <>
                      <option value="TRIAL">Prueba</option>
                      <option value="ACTIVE">Activa</option>
                      <option value="PAST_DUE">Pendiente de pago</option>
                      <option value="CANCELED">Cancelada</option>
                    </>
                  )}
                </select>
              </FormField>
              <FormField label="Periodicidad" htmlFor="platform-subscription-interval">
                <select
                  id="platform-subscription-interval"
                  className="input"
                  value={interval}
                  disabled={planCode === 'ESSENTIAL'}
                  onChange={(event) => setInterval(event.target.value)}
                >
                  {planCode === 'ESSENTIAL' ? <option value="NONE">No aplica</option> : null}
                  <option value="MONTHLY">Mensual</option>
                  <option value="ANNUAL">Anual</option>
                </select>
              </FormField>
              <FormField label="Inicio" htmlFor="platform-subscription-start">
                <TextInput
                  id="platform-subscription-start"
                  type="date"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                  required
                />
              </FormField>
              {status === 'TRIAL' ? (
                <FormField label="Fin de prueba" htmlFor="platform-subscription-trial-end">
                  <TextInput
                    id="platform-subscription-trial-end"
                    type="date"
                    value={trialEndsAt}
                    onChange={(event) => setTrialEndsAt(event.target.value)}
                    required
                  />
                </FormField>
              ) : null}
              <FormField label="Fin de vigencia (opcional)" htmlFor="platform-subscription-end">
                <TextInput
                  id="platform-subscription-end"
                  type="date"
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
                />
              </FormField>
              <FormField
                label="Motivo del cambio"
                htmlFor="platform-subscription-reason"
                hint="Se guardará en la auditoría de plataforma."
              >
                <TextInput
                  id="platform-subscription-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  minLength={5}
                  maxLength={500}
                  required
                />
              </FormField>
            </div>
            <div className="platform-confirm-card__actions">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setSelected(null)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || reason.trim().length < 5}>
                {saving ? 'Guardando…' : 'Guardar suscripción'}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="platform-panel">
        <div className="platform-toolbar">
          <FormField label="Buscar clínica" htmlFor="platform-subscription-search">
            <TextInput
              id="platform-subscription-search"
              type="search"
              placeholder="Nombre o identificador"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </FormField>
          <p className="platform-result-count">
            {total} {total === 1 ? 'clínica' : 'clínicas'}
          </p>
        </div>
        <div className="platform-table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th scope="col">Clínica</th>
                <th scope="col">Plan</th>
                <th scope="col">Estado</th>
                <th scope="col">Periodicidad</th>
                <th scope="col">Vigencia</th>
                <th scope="col">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((organization) => (
                <tr key={organization.id}>
                  <td>
                    <strong>{organization.name}</strong>
                    <small>/{organization.slug}</small>
                  </td>
                  <td>
                    {organization.subscription?.planName ?? (
                      <span className="platform-muted">Sin plan</span>
                    )}
                  </td>
                  <td>
                    {organization.subscription ? (
                      <span
                        className={`platform-status platform-status--${organization.subscription.status.toLowerCase().replace('_', '-')}`}
                      >
                        {subscriptionStatusLabel(organization.subscription.status)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {organization.subscription?.interval === 'ANNUAL'
                      ? 'Anual'
                      : organization.subscription?.interval === 'MONTHLY'
                        ? 'Mensual'
                        : organization.subscription
                          ? 'No aplica'
                          : '—'}
                  </td>
                  <td>
                    {organization.subscription?.endsAt
                      ? dateLabel(organization.subscription.endsAt)
                      : 'Sin fecha de fin'}
                  </td>
                  <td className="platform-table__action">
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => openAssignment(organization)}
                    >
                      {organization.subscription ? 'Administrar' : 'Asignar plan'}
                    </Button>
                  </td>
                </tr>
              ))}
              {!organizations.length ? (
                <tr>
                  <td colSpan={6} className="platform-table__empty">
                    {loading
                      ? 'Cargando suscripciones…'
                      : 'No hay clínicas que coincidan con la búsqueda.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={page}
          totalPages={pageCount}
          onChange={setPage}
          ariaLabel="Paginación de suscripciones"
        />
        <p className="platform-table__note">
          Mostrando {organizations.length} de {total} clínicas. La gestión de pagos y los límites de
          uso aún no están habilitados.
        </p>
      </Card>
    </div>
  );
}
