import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { PageHeader } from '../../components/ui/PageHeader';
import { TextInput } from '../../components/ui/TextInput';
import type { PlatformOrganization } from '@veterinary-saas/contracts';
import { platformApi } from './platformApi';

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(value));
}

function OrganizationStatus({ status }: { status: PlatformOrganization['status'] }) {
  const label =
    status === 'ACTIVE' ? 'Activa' : status === 'SUSPENDED' ? 'Suspendida' : 'Archivada';
  return (
    <span className={`platform-status platform-status--${status.toLowerCase()}`}>{label}</span>
  );
}

export function PlatformOverviewPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof platformApi.overview>> | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    platformApi
      .overview(controller.signal)
      .then((result) => setData(result))
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
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

      <Card className="platform-panel">
        <div className="platform-panel__heading">
          <div>
            <p className="section-kicker">Altas recientes</p>
            <h2>Clínicas que se unieron a Easyvet</h2>
          </div>
          <Link to="/plataforma/clinicas">
            Ver todas <span aria-hidden="true">↗</span>
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
            {error ? 'Resumen no disponible.' : 'Cargando actividad…'}
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
      .organizations({ search, status }, controller.signal)
      .then((result) => {
        setOrganizations(result.data);
        setTotal(result.total);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('No fue posible cargar las clínicas.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [search, status, reloadKey]);

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
              onChange={(event) => setSearch(event.target.value)}
            />
          </FormField>
          <FormField label="Estado" htmlFor="platform-org-status">
            <select
              id="platform-org-status"
              className="input"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
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
                    <strong>{organization.name}</strong>
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
        <p className="platform-table__note">
          Se muestran hasta 100 clínicas por consulta. La consola no presenta información clínica.
        </p>
      </Card>
    </div>
  );
}

export function PlatformActivityPage() {
  const [events, setEvents] = useState<Awaited<ReturnType<typeof platformApi.activity>>['data']>(
    [],
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    platformApi
      .activity(controller.signal)
      .then((result) => setEvents(result.data))
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="platform-page">
      <PageHeader
        eyebrow="Administración · seguridad"
        title="Auditoría de plataforma"
        description="Cambios administrativos recientes, con quién los realizó y el motivo registrado."
      />
      {error ? <Alert tone="error">No fue posible cargar la auditoría.</Alert> : null}
      <Card className="platform-panel">
        {events.length ? (
          <div className="platform-activity-list">
            {events.map((event) => {
              const from = typeof event.metadata?.from === 'string' ? event.metadata.from : '';
              const to = typeof event.metadata?.to === 'string' ? event.metadata.to : '';
              const reason =
                typeof event.metadata?.reason === 'string' ? event.metadata.reason : 'Sin motivo';
              return (
                <article className="platform-activity-row" key={event.id}>
                  <span className="platform-activity-row__marker" aria-hidden="true">
                    ↗
                  </span>
                  <div className="platform-activity-row__content">
                    <strong>
                      {event.organizationName ?? 'Clínica archivada'} · {from} → {to}
                    </strong>
                    <p>{reason}</p>
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
            {error ? 'Auditoría no disponible.' : 'Aún no hay cambios administrativos registrados.'}
          </p>
        )}
      </Card>
    </div>
  );
}
