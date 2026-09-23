import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SaleStatus } from '@veterinary-saas/contracts';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { useCommercialResource } from './useCommercialResource';
import { commercialApi } from './commercialApi';
import { CommercialHeader, CommercialState, StatusPill } from './CommercialPrimitives';
import { formatMoney } from './commercialUtils';
import './commercial.css';

const SALE_STATES: Array<{ value: SaleStatus | ''; label: string }> = [
  { value: '', label: 'Todos los estados' },
  { value: 'DRAFT', label: 'Borradores' },
  { value: 'COMPLETED', label: 'Completadas' },
  { value: 'VOIDED', label: 'Anuladas' },
];

// Sales list filters remain in the URL-independent page state and refresh after returning from an operation.
export function SalesListPage() {
  const canCreate = useCan(PERMISSION.SALES_CREATE);
  const [status, setStatus] = useState<SaleStatus | ''>('');
  const [page, setPage] = useState(1);
  const loader = useCallback(
    (signal: AbortSignal) =>
      commercialApi.listSales({ page, pageSize: 20, ...(status ? { status } : {}) }, signal),
    [page, status],
  );
  const resource = useCommercialResource(loader);
  const sales = resource.data?.data ?? [];
  const totalPages = resource.data?.pagination.totalPages ?? 0;
  const countLabel = useMemo(
    () => `${resource.data?.pagination.total ?? 0} ventas`,
    [resource.data],
  );

  return (
    <div className="page-stack commercial-page">
      <CommercialHeader
        title="Ventas"
        description="Crea borradores, cobra y conserva un historial verificable por sede."
        action={
          canCreate ? (
            <Button as={Link} to="/ventas/nueva">
              Nueva venta
            </Button>
          ) : undefined
        }
      />
      <section className="commercial-toolbar" aria-label="Filtros de ventas">
        <label className="commercial-field">
          <span>Estado</span>
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as SaleStatus | '');
              setPage(1);
            }}
          >
            {SALE_STATES.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
        <p className="commercial-count">{countLabel}</p>
      </section>
      <CommercialState
        loading={resource.loading}
        error={resource.error}
        empty={!resource.loading && !resource.error && sales.length === 0}
        retry={resource.reload}
      />
      {sales.length > 0 ? (
        <div className="commercial-list" aria-label="Ventas">
          {sales.map((sale) => (
            <Link className="commercial-row" to={`/ventas/${sale.id}`} key={sale.id}>
              <span className="commercial-row__main">
                <strong>Venta · {sale.clinicLocationName}</strong>
                <small>
                  {sale.customerNameSnapshot ?? 'Consumidor final'}
                  {sale.patientNameSnapshot ? ` · ${sale.patientNameSnapshot}` : ''}
                </small>
              </span>
              <span className="commercial-row__meta">
                <StatusPill status={sale.status} />
                <strong>{formatMoney(sale.grandTotal, sale.currencyCode)}</strong>
                <small>
                  {new Intl.DateTimeFormat('es-CO', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(sale.createdAt))}
                </small>
              </span>
            </Link>
          ))}
          {totalPages > 1 ? (
            <nav className="commercial-pagination" aria-label="Paginación de ventas">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Anterior
              </Button>
              <span>
                Página {page} de {totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Siguiente
              </Button>
            </nav>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
