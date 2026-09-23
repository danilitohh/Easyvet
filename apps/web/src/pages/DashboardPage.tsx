import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DataTable, type DataTableColumn } from '../components/ui/DataTable';
import { FormField } from '../components/ui/FormField';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import { Select } from '../components/ui/Select';
import { FollowUpDashboardWidget } from '../features/follow-ups/FollowUpDashboardWidget';
import {
  demoAppointments,
  demoPulse,
  dashboardStats,
  type DemoAppointment,
} from '../mocks/dashboard';

const appointmentColumns: DataTableColumn<DemoAppointment>[] = [
  {
    key: 'time',
    header: 'Hora',
    render: (row) => <strong className="table-time">{row.time}</strong>,
  },
  {
    key: 'patient',
    header: 'Paciente',
    render: (row) => (
      <span className="table-identity">
        <strong>{row.patient}</strong>
        <small>{row.owner}</small>
      </span>
    ),
  },
  { key: 'service', header: 'Servicio', render: (row) => row.service },
  {
    key: 'status',
    header: 'Estado',
    render: (row) => (
      <Badge
        tone={
          row.status === 'Confirmada' ? 'success' : row.status === 'En curso' ? 'info' : 'warning'
        }
      >
        {row.status}
      </Badge>
    ),
  },
];

// Appointment and pulse demo cards remain isolated from the live Follow-up dashboard widget.
export function DashboardPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const filteredAppointments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return demoAppointments.filter((appointment) => {
      const matchesStatus = status === 'all' || appointment.status === status;
      const matchesSearch =
        !normalizedSearch ||
        [appointment.patient, appointment.owner, appointment.service].some((value) =>
          value.toLowerCase().includes(normalizedSearch),
        );
      return matchesStatus && matchesSearch;
    });
  }, [search, status]);

  return (
    <div className="page-stack dashboard-page">
      <PageHeader
        eyebrow="Panel principal"
        title="Una vista tranquila de la operación."
        description="Prioriza la jornada, detecta pendientes y deja el detalle para cada módulo."
        action={
          <Button as={Link} to="/health" variant="secondary">
            Revisar API
          </Button>
        }
      />

      <Alert tone="info">
        <strong>Vista demo.</strong> Las citas y estadísticas de agenda son ficticias y no provienen
        de PostgreSQL ni del backend.
      </Alert>

      <FollowUpDashboardWidget />

      <section className="stats-grid" aria-label="Indicadores de demostración">
        {dashboardStats.map((stat) => (
          <Card className={`stat-card stat-card--${stat.tone}`} key={stat.label}>
            <span className="stat-card__label">{stat.label}</span>
            <strong>{stat.value}</strong>
            <span className="stat-card__detail">{stat.detail}</span>
          </Card>
        ))}
      </section>

      <section className="dashboard-grid" aria-label="Resumen de operación">
        <Card className="dashboard-card dashboard-card--appointments">
          <div className="card-heading">
            <div>
              <p className="section-kicker">Agenda demo</p>
              <h2>Citas de hoy</h2>
            </div>
            <Link className="text-link" to="/agenda">
              Abrir agenda
            </Link>
          </div>
          <div className="filter-row">
            <FormField label="Buscar citas" htmlFor="dashboard-search">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Paciente, propietario o servicio"
              />
            </FormField>
            <FormField label="Estado" htmlFor="dashboard-status">
              <Select
                id="dashboard-status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="all">Todos</option>
                <option value="Confirmada">Confirmadas</option>
                <option value="En curso">En curso</option>
                <option value="Pendiente">Pendientes</option>
              </Select>
            </FormField>
          </div>
          <DataTable
            columns={appointmentColumns}
            rows={filteredAppointments}
            getRowKey={(row) => row.id}
            emptyTitle="No hay citas para ese filtro"
            emptyDescription="Prueba con otro término o estado."
          />
        </Card>

        <Card className="dashboard-card dashboard-card--pulse">
          <div className="card-heading">
            <div>
              <p className="section-kicker">Lectura rápida</p>
              <h2>Pulso de la clínica</h2>
            </div>
            <Badge tone="info">Demo</Badge>
          </div>
          <div className="pulse-list">
            {demoPulse.map((item) => (
              <div className="pulse-item" key={item.label}>
                <span
                  className={`pulse-item__marker pulse-item__marker--${item.tone}`}
                  aria-hidden="true"
                />
                <div>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.detail}</small>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="quick-section" aria-labelledby="quick-title">
        <div className="card-heading">
          <div>
            <p className="section-kicker">Accesos frecuentes</p>
            <h2 id="quick-title">Continúa desde aquí</h2>
          </div>
        </div>
        <div className="quick-grid">
          <Link className="quick-card" to="/pacientes">
            <span className="quick-card__icon" aria-hidden="true">
              ●
            </span>
            <span>
              <strong>Explorar pacientes</strong>
              <small>La ruta está preparada para el futuro módulo clínico.</small>
            </span>
            <span className="quick-card__arrow" aria-hidden="true">
              ↗
            </span>
          </Link>
          <Link className="quick-card" to="/inventario">
            <span className="quick-card__icon" aria-hidden="true">
              ▥
            </span>
            <span>
              <strong>Revisar inventario</strong>
              <small>Catálogo, existencias, lotes y movimientos por sede.</small>
            </span>
            <span className="quick-card__arrow" aria-hidden="true">
              ↗
            </span>
          </Link>
          <Link className="quick-card" to="/informes">
            <span className="quick-card__icon" aria-hidden="true">
              ▦
            </span>
            <span>
              <strong>Ver informes</strong>
              <small>La analítica se definirá con datos de negocio reales.</small>
            </span>
            <span className="quick-card__arrow" aria-hidden="true">
              ↗
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
