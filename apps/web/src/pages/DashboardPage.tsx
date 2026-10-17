import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { EasyvetIcon } from '../components/icons/EasyvetIcon';
import { useCan } from '../auth/useCan';
import { PERMISSION } from '../auth/permissions';
import { useAuth } from '../contexts/useAuth';
import { FollowUpDashboardWidget } from '../features/follow-ups/FollowUpDashboardWidget';
import type { OperationalReportResponse } from '@veterinary-saas/contracts';
import { useRealtimeRevision } from '../contexts/useRealtime';

// Dashboard summaries use tenant-scoped aggregates and never present fixture data as live activity.
export function DashboardPage() {
  const { activeMembership } = useAuth();
  const organizationId = activeMembership?.organization.id ?? '';
  const realtimeRevision = useRealtimeRevision();
  const canReadOperational = useCan(PERMISSION.REPORTS_OPERATIONAL);
  const canReadFollowUps = useCan(PERMISSION.FOLLOW_UPS_READ);
  const canReadPatients = useCan(PERMISSION.PATIENTS_READ);
  const canReadInventory = useCan(PERMISSION.INVENTORY_READ);
  const canReadReports = useCan(PERMISSION.REPORTS_OPERATIONAL);
  const [summary, setSummary] = useState<OperationalReportResponse | null>(null);
  const [summaryOrganizationId, setSummaryOrganizationId] = useState('');
  const [summaryError, setSummaryError] = useState(false);

  useEffect(() => {
    if (!canReadOperational || !organizationId) return undefined;
    const controller = new AbortController();
    setSummary(null);
    setSummaryError(false);
    import('../features/admin/adminApi')
      .then(({ adminApi }) => adminApi.operationalReport({}, controller.signal))
      .then((result) => {
        if (!controller.signal.aborted) setSummary(result);
        if (!controller.signal.aborted) setSummaryOrganizationId(organizationId);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSummaryError(true);
          setSummaryOrganizationId(organizationId);
        }
      });
    return () => controller.abort();
  }, [canReadOperational, organizationId, realtimeRevision]);

  const visibleSummary = summaryOrganizationId === organizationId ? summary : null;
  const visibleSummaryError = summaryOrganizationId === organizationId && summaryError;

  return (
    <div className="page-stack dashboard-page">
      <PageHeader
        eyebrow="Panel principal"
        title="Una vista tranquila de la operación."
        description="Prioriza pendientes y consulta indicadores agregados de la organización activa."
        action={
          <Button as={Link} to="/health" variant="secondary">
            Estado de la API
          </Button>
        }
      />

      {canReadFollowUps ? <FollowUpDashboardWidget /> : null}

      {canReadOperational ? (
        <section className="stats-grid" aria-label="Resumen operacional de los últimos 30 días">
          {visibleSummaryError ? (
            <Alert tone="warning">No fue posible cargar el resumen operacional.</Alert>
          ) : null}
          {visibleSummary ? (
            <>
              <Card className="stat-card stat-card--info">
                <span className="stat-card__label">Citas en los últimos 30 días</span>
                <strong>{visibleSummary.appointments.total}</strong>
                <span className="stat-card__detail">
                  {visibleSummary.appointments.completed} completadas
                </span>
              </Card>
              <Card className="stat-card stat-card--success">
                <span className="stat-card__label">Seguimientos abiertos</span>
                <strong>{visibleSummary.followUps.open}</strong>
                <span className="stat-card__detail">
                  {visibleSummary.followUps.overdue} vencidos
                </span>
              </Card>
              <Card className="stat-card stat-card--warning">
                <span className="stat-card__label">Servicios de peluquería completados</span>
                <strong>{visibleSummary.grooming.completed}</strong>
                <span className="stat-card__detail">En el periodo consultado</span>
              </Card>
            </>
          ) : !visibleSummaryError ? (
            <Card className="stat-card">
              <span className="stat-card__label">Cargando resumen real…</span>
            </Card>
          ) : null}
        </section>
      ) : null}

      <section className="quick-section" aria-labelledby="quick-title">
        <div className="card-heading">
          <div>
            <p className="section-kicker">Accesos frecuentes</p>
            <h2 id="quick-title">Continúa desde aquí</h2>
          </div>
        </div>
        <div className="quick-grid">
          {canReadPatients ? (
            <Link className="quick-card" to="/pacientes">
              <span className="quick-card__icon" aria-hidden="true">
                <EasyvetIcon name="paw" size={20} />
              </span>
              <span>
                <strong>Explorar pacientes</strong>
                <small>Consulta pacientes de la organización activa.</small>
              </span>
              <span className="quick-card__arrow" aria-hidden="true">
                <EasyvetIcon name="arrow-up-right" size={16} />
              </span>
            </Link>
          ) : null}
          {canReadInventory ? (
            <Link className="quick-card" to="/inventario">
              <span className="quick-card__icon" aria-hidden="true">
                <EasyvetIcon name="package" size={20} />
              </span>
              <span>
                <strong>Revisar inventario</strong>
                <small>Catálogo, existencias, lotes y movimientos por sede.</small>
              </span>
              <span className="quick-card__arrow" aria-hidden="true">
                <EasyvetIcon name="arrow-up-right" size={16} />
              </span>
            </Link>
          ) : null}
          {canReadReports ? (
            <Link className="quick-card" to="/informes">
              <span className="quick-card__icon" aria-hidden="true">
                <EasyvetIcon name="bar-chart" size={20} />
              </span>
              <span>
                <strong>Ver informes</strong>
                <small>Indicadores filtrados por permiso y periodo.</small>
              </span>
              <span className="quick-card__arrow" aria-hidden="true">
                <EasyvetIcon name="arrow-up-right" size={16} />
              </span>
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
