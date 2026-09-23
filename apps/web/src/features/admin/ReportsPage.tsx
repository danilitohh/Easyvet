import { useEffect, useMemo, useState } from 'react';
import type {
  ClinicalReportResponse,
  CommercialReportResponse,
  InventoryReportResponse,
  LocationResponse,
  OperationalReportResponse,
} from '@veterinary-saas/contracts';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { TextInput } from '../../components/ui/TextInput';
import { useCan } from '../../auth/useCan';
import { PERMISSION } from '../../auth/permissions';
import { useAuth } from '../../contexts/useAuth';
import { ApiError } from '../../services/apiClient';
import { adminApi } from './adminApi';
import './admin.css';

type ReportTab = 'operational' | 'clinical' | 'commercial' | 'inventory';
type ReportData =
  | OperationalReportResponse
  | ClinicalReportResponse
  | CommercialReportResponse
  | InventoryReportResponse;

const REPORT_TABS: Array<{ id: ReportTab; label: string; permission: string }> = [
  { id: 'operational', label: 'Resumen operacional', permission: PERMISSION.REPORTS_OPERATIONAL },
  { id: 'clinical', label: 'Clínico', permission: PERMISSION.REPORTS_CLINICAL },
  { id: 'commercial', label: 'Comercial', permission: PERMISSION.REPORTS_COMMERCIAL },
  { id: 'inventory', label: 'Inventario', permission: PERMISSION.REPORTS_INVENTORY },
];

function civilToday(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addCivilDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function reportError(error: unknown) {
  if (error instanceof ApiError && error.code === 'LOCATION_NOT_FOUND') {
    return 'La sede seleccionada ya no pertenece a la organización activa.';
  }
  if (error instanceof ApiError && error.code === 'INVALID_REPORT_RANGE') {
    return 'El rango debe ser válido y no puede superar 366 días.';
  }
  return 'No fue posible cargar este informe. Verifica el rango y vuelve a intentar.';
}

function number(value: number) {
  return new Intl.NumberFormat('es-CO').format(value);
}

function money(value: string, currencyCode: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${currencyCode} ${value}`;
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currencyCode} ${value}`;
  }
}

// Reports are permission-adaptive and use bounded civil date ranges in the organization's timezone.
export function ReportsPage() {
  const { activeMembership } = useAuth();
  const organizationId = activeMembership?.organization.id ?? '';
  const canOperational = useCan(PERMISSION.REPORTS_OPERATIONAL);
  const canClinical = useCan(PERMISSION.REPORTS_CLINICAL);
  const canCommercial = useCan(PERMISSION.REPORTS_COMMERCIAL);
  const canInventory = useCan(PERMISSION.REPORTS_INVENTORY);
  const tabs = useMemo(
    () =>
      REPORT_TABS.filter((tab) => {
        if (tab.id === 'operational') return canOperational;
        if (tab.id === 'clinical') return canClinical;
        if (tab.id === 'commercial') return canCommercial;
        return canInventory;
      }),
    [canClinical, canCommercial, canInventory, canOperational],
  );
  const [tab, setTab] = useState<ReportTab>('operational');
  const selectedTab = tabs.some((candidate) => candidate.id === tab) ? tab : tabs[0]?.id;
  const [locations, setLocations] = useState<LocationResponse[]>([]);
  const [locationsOrganizationId, setLocationsOrganizationId] = useState('');
  const [settingsOrganizationId, setSettingsOrganizationId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [locationId, setLocationId] = useState('');
  const [data, setData] = useState<ReportData | null>(null);
  const [dataOrganizationId, setDataOrganizationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!organizationId) return undefined;
    const controller = new AbortController();
    setLocations([]);
    setLocationsOrganizationId('');
    setSettingsOrganizationId('');
    setData(null);
    setDataOrganizationId('');
    setFrom('');
    setTo('');
    setLocationId('');
    Promise.all([
      adminApi.currentOrganization(controller.signal),
      adminApi.listLocations(controller.signal),
    ])
      .then(([organization, branches]) => {
        if (controller.signal.aborted) return;
        const today = civilToday(organization.timezone);
        setFrom(addCivilDays(today, -29));
        setTo(today);
        setLocations(branches);
        setLocationsOrganizationId(organizationId);
        setSettingsOrganizationId(organizationId);
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setError(reportError(caught));
          setSettingsOrganizationId(organizationId);
        }
      });
    return () => controller.abort();
  }, [organizationId]);

  useEffect(() => {
    if (
      !organizationId ||
      settingsOrganizationId !== organizationId ||
      !selectedTab ||
      !from ||
      !to
    )
      return undefined;
    const controller = new AbortController();
    setData(null);
    setLoading(true);
    setError('');
    const query = { from, to, ...(locationId ? { clinicLocationId: locationId } : {}) };
    const request =
      selectedTab === 'operational'
        ? adminApi.operationalReport(query, controller.signal)
        : selectedTab === 'clinical'
          ? adminApi.clinicalReport(query, controller.signal)
          : selectedTab === 'commercial'
            ? adminApi.commercialReport(query, controller.signal)
            : adminApi.inventoryReport(query, controller.signal);
    request
      .then((report) => {
        if (controller.signal.aborted) return;
        setData(report);
        setDataOrganizationId(organizationId);
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setError(reportError(caught));
          setDataOrganizationId(organizationId);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [from, locationId, organizationId, selectedTab, settingsOrganizationId, to]);

  const scopeReady = settingsOrganizationId === organizationId;
  const visibleLocations = locationsOrganizationId === organizationId ? locations : [];
  const visibleData = dataOrganizationId === organizationId ? data : null;

  if (!scopeReady) {
    return (
      <div className="page-stack admin-page reports-page">
        <PageHeader
          eyebrow="Lectura de negocio"
          title="Informes"
          description="Indicadores agregados de la organización activa."
        />
        <LoadingState label="Cargando informes de la organización…" />
      </div>
    );
  }

  return (
    <div className="page-stack admin-page reports-page">
      <PageHeader
        eyebrow="Lectura de negocio"
        title="Informes"
        description="Indicadores agregados de la organización activa. Las fechas son civiles y se interpretan en su zona horaria."
      />
      {!tabs.length ? (
        <Alert tone="warning">Tu rol no tiene permisos para consultar informes.</Alert>
      ) : null}
      {tabs.length ? (
        <>
          <Card className="admin-filter-card">
            <div className="report-filter-grid">
              <FormField label="Desde" htmlFor="report-from">
                <TextInput
                  id="report-from"
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </FormField>
              <FormField label="Hasta" htmlFor="report-to">
                <TextInput
                  id="report-to"
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
              </FormField>
              <FormField label="Sede" htmlFor="report-location">
                <Select
                  id="report-location"
                  value={locationId}
                  onChange={(event) => setLocationId(event.target.value)}
                >
                  <option value="">Todas las sedes</option>
                  {visibleLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                      {location.status === 'ACTIVE' ? '' : ' · Inactiva'}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
          </Card>
          <div className="admin-tabs" role="tablist" aria-label="Tipo de informe">
            {tabs.map((item) => (
              <button
                className={selectedTab === item.id ? 'admin-tab is-active' : 'admin-tab'}
                key={item.id}
                id={`report-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={selectedTab === item.id}
                aria-controls="report-panel"
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <section
            id="report-panel"
            role="tabpanel"
            aria-labelledby={`report-tab-${selectedTab}`}
            className="report-results"
          >
            {visibleData && 'range' in visibleData ? (
              <p className="report-range">
                {visibleData.range.from} – {visibleData.range.to} · {visibleData.range.timezone}
              </p>
            ) : null}
            {error ? <Alert tone="error">{error}</Alert> : null}
            {loading ? <LoadingState label="Calculando informe…" /> : null}
            {!loading && visibleData ? (
              <ReportResults tab={selectedTab!} data={visibleData} />
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

// Metric rows keep counts readable without implying unsupported financial or clinical conclusions.
function ReportResults({ tab, data }: { tab: ReportTab; data: ReportData }) {
  if (tab === 'operational' && 'appointments' in data) {
    const metrics = [
      ['Citas en el rango', data.appointments.total],
      ['Completadas', data.appointments.completed],
      ['Canceladas', data.appointments.cancelled],
      ['Inasistencias', data.appointments.noShow],
      ['Seguimientos abiertos', data.followUps.open],
      ['Seguimientos vencidos', data.followUps.overdue],
      ['Seguimientos para hoy', data.followUps.dueToday],
      ['Peluquería: borradores', data.grooming.draft],
      ['Peluquería: en curso', data.grooming.inProgress],
      ['Peluquería: completados', data.grooming.completed],
      ['Hospitalizaciones activas', data.hospitalization.currentlyActive],
      ['Ingresos en el rango', data.hospitalization.admissions],
      ['Egresos en el rango', data.hospitalization.discharges],
    ] as const;
    return <MetricList title="Resumen operacional" metrics={metrics} />;
  }
  if (tab === 'clinical' && 'finalized' in data) {
    const metrics = [
      ['Consultas finalizadas', data.finalized.clinicalEncounters],
      ['Prescripciones finalizadas', data.finalized.prescriptions],
      ['Vacunaciones finalizadas', data.finalized.vaccinations],
      ['Desparasitaciones finalizadas', data.finalized.dewormings],
      ['Procedimientos finalizados', data.finalized.procedures],
      ['Anestesias finalizadas', data.finalized.anesthesia],
      ['Resultados diagnósticos', data.finalized.diagnosticOrdersResulted],
      ['Egresos de hospitalización', data.finalized.hospitalizationDischarges],
      ['Consentimientos firmados', data.finalized.consentsSigned],
    ] as const;
    return <MetricList title="Actividad clínica finalizada" metrics={metrics} />;
  }
  if (tab === 'commercial' && 'totalsByCurrency' in data) {
    return (
      <div className="page-stack">
        <div className="admin-section-heading">
          <h2>Ventas y recaudo</h2>
          <Badge tone="info">Monedas separadas</Badge>
        </div>
        {data.totalsByCurrency.length ? (
          data.totalsByCurrency.map((row) => (
            <Card className="report-currency-card" key={row.currencyCode}>
              <h3>{row.currencyCode}</h3>
              <dl className="report-metric-list">
                <Metric label="Ventas completadas" value={number(row.completedSales)} />
                <Metric label="Ventas anuladas" value={number(row.voidedSales)} />
                <Metric
                  label="Ingresos de ventas completadas"
                  value={money(row.revenue, row.currencyCode)}
                />
                <Metric label="Descuentos" value={money(row.discounts, row.currencyCode)} />
                <Metric
                  label="Ticket promedio"
                  value={money(row.averageTicket, row.currencyCode)}
                />
                <Metric
                  label="Valor de ventas anuladas"
                  value={money(row.voidedValue, row.currencyCode)}
                />
              </dl>
            </Card>
          ))
        ) : (
          <p className="admin-empty-copy">No hay ventas para este periodo.</p>
        )}
        <Card className="admin-list-card">
          <h3>Pagos registrados</h3>
          {data.paymentsByCurrency.length ? (
            <div className="report-metric-list">
              {data.paymentsByCurrency.map((payment) => (
                <Metric
                  key={`${payment.currencyCode}-${payment.method}`}
                  label={`${payment.currencyCode} · ${payment.method}`}
                  value={money(payment.total, payment.currencyCode)}
                />
              ))}
            </div>
          ) : (
            <p className="admin-empty-copy">No hay pagos publicados en el periodo.</p>
          )}
        </Card>
        <Card className="admin-list-card">
          <h3>Facturación y cierres</h3>
          <div className="report-metric-list">
            <Metric label="Facturas emitidas" value={number(data.invoices.issued)} />
            <Metric label="Facturas anuladas" value={number(data.invoices.voided)} />
          </div>
          {data.cashSessionsByCurrency.map((cash) => (
            <div className="report-cash-row" key={cash.currencyCode}>
              <strong>{cash.currencyCode}</strong>
              <span>{number(cash.closedSessions)} cierres</span>
              <span>Diferencia: {money(cash.difference, cash.currencyCode)}</span>
            </div>
          ))}
        </Card>
      </div>
    );
  }
  if (tab === 'inventory' && 'activeItems' in data) {
    return (
      <MetricList
        title="Inventario"
        metrics={[
          ['Productos activos', data.activeItems],
          ['Productos archivados', data.archivedItems],
          ['Combinaciones con existencias bajas', data.lowStockItemLocations],
          ['Lotes vencidos con existencias', data.expiredBatchesWithStock],
          ['Lotes por vencer (30 días)', data.expiringSoonBatchesWithStock],
          ['Movimientos del periodo', data.stockMovements],
        ]}
        note="No se presenta valoración monetaria del inventario."
      />
    );
  }
  return <p className="admin-empty-copy">No hay métricas disponibles para esta pestaña.</p>;
}

function MetricList({
  title,
  metrics,
  note,
}: {
  title: string;
  metrics: ReadonlyArray<readonly [string, number]>;
  note?: string;
}) {
  return (
    <Card className="admin-list-card">
      <h2>{title}</h2>
      <dl className="report-metric-list">
        {metrics.map(([label, value]) => (
          <Metric key={label} label={label} value={number(value)} />
        ))}
      </dl>
      {note ? <p className="admin-note">{note}</p> : null}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="report-metric-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
