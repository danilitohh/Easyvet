import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import type { InvoiceStatus } from '@veterinary-saas/contracts';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { commercialApi } from './commercialApi';
import { CommercialHeader, CommercialState, StatusPill } from './CommercialPrimitives';
import { formatMoney } from './commercialUtils';
import { useCommercialResource } from './useCommercialResource';
import './commercial.css';

// Internal Billing stays read-only and links every issued document back to its immutable detail.
export function BillingPage() {
  const [status, setStatus] = useState<InvoiceStatus | ''>('');
  const [page, setPage] = useState(1);
  const loader = useCallback(
    (signal: AbortSignal) =>
      commercialApi.listInvoices({ page, pageSize: 20, ...(status ? { status } : {}) }, signal),
    [page, status],
  );
  const resource = useCommercialResource(loader);
  const invoices = resource.data?.data ?? [];
  const totalPages = resource.data?.pagination.totalPages ?? 0;
  return (
    <div className="page-stack commercial-page">
      <CommercialHeader
        title="Facturación"
        description="Comprobantes internos emitidos por las ventas de la organización."
      />
      <section className="commercial-toolbar">
        <label className="commercial-field">
          <span>Estado del comprobante</span>
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as InvoiceStatus | '');
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            <option value="ISSUED">Emitidos</option>
            <option value="VOIDED">Anulados</option>
          </Select>
        </label>
        <p className="commercial-count">{resource.data?.pagination.total ?? 0} comprobantes</p>
      </section>
      <CommercialState
        loading={resource.loading}
        error={resource.error}
        empty={!resource.loading && !resource.error && invoices.length === 0}
        retry={resource.reload}
      />
      {invoices.length ? (
        <div className="commercial-list" aria-label="Comprobantes">
          {invoices.map((invoice) => (
            <Link className="commercial-row" to={`/facturacion/${invoice.id}`} key={invoice.id}>
              <span className="commercial-row__main">
                <strong>{invoice.documentNumber}</strong>
                <small>
                  {invoice.customerNameSnapshot ?? 'Consumidor final'} ·{' '}
                  {invoice.clinicLocationName}
                </small>
              </span>
              <span className="commercial-row__meta">
                <StatusPill status={invoice.status} />
                <strong>{formatMoney(invoice.total, invoice.currencyCode)}</strong>
                <small>
                  {new Intl.DateTimeFormat('es-CO', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(invoice.issuedAt))}
                </small>
              </span>
            </Link>
          ))}
          {totalPages > 1 ? (
            <nav className="commercial-pagination" aria-label="Paginación de comprobantes">
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
