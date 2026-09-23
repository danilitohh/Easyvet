import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { commercialApi } from './commercialApi';
import { BackLink, CommercialHeader, CommercialState, StatusPill } from './CommercialPrimitives';
import {
  formatMoney,
  lineSubtotal,
  moneyUnits,
  PAYMENT_METHOD_LABEL,
  unitsToDecimal,
} from './commercialUtils';
import { useCommercialResource } from './useCommercialResource';
import './commercial.css';

// Printable invoice detail displays frozen snapshots and offers only a browser print action.
export function InvoiceDetailPage() {
  const { invoiceId = '' } = useParams();
  const loader = useCallback(
    (signal: AbortSignal) => commercialApi.getInvoice(invoiceId, signal),
    [invoiceId],
  );
  const resource = useCommercialResource(loader);
  const invoice = resource.data;
  if (!invoice)
    return (
      <div className="page-stack commercial-page">
        <CommercialHeader title="Comprobante" description="Detalle del documento emitido." />
        <CommercialState
          loading={resource.loading}
          error={resource.error}
          empty={false}
          retry={resource.reload}
        />
      </div>
    );
  const currency = invoice.currencyCode;
  return (
    <div className="page-stack commercial-page invoice-page">
      <CommercialHeader
        title={invoice.documentNumber}
        description="Comprobante comercial interno de Easyvet."
        action={
          <div className="commercial-actions">
            <BackLink to="/facturacion">Facturación</BackLink>
            <Button onClick={() => window.print()}>Imprimir</Button>
          </div>
        }
      />
      <Card className="commercial-section invoice-paper">
        <div className="invoice-brand">
          <div>
            <h2>{invoice.organizationName}</h2>
            <p>{invoice.clinicLocationName}</p>
          </div>
          <StatusPill status={invoice.status} />
        </div>
        <div className="invoice-parties">
          <div>
            <span>Comprobante</span>
            <strong>{invoice.documentNumber}</strong>
            <small>
              {new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' }).format(
                new Date(invoice.issuedAt),
              )}
            </small>
          </div>
          <div>
            <span>Cliente</span>
            <strong>{invoice.customerNameSnapshot ?? 'Consumidor final'}</strong>
            {invoice.customerDocumentNumberSnapshot ? (
              <small>
                {invoice.customerDocumentTypeSnapshot ?? 'Documento'} ·{' '}
                {invoice.customerDocumentNumberSnapshot}
              </small>
            ) : null}
            {invoice.patientNameSnapshot ? (
              <small>Paciente: {invoice.patientNameSnapshot}</small>
            ) : null}
          </div>
        </div>
        <div className="invoice-lines" role="list" aria-label="Conceptos facturados">
          <div className="invoice-line invoice-line--heading">
            <span>Concepto</span>
            <span>Cantidad</span>
            <span>Precio</span>
            <span>Descuento</span>
            <span>Total</span>
          </div>
          {invoice.items.map((item) => (
            <div className="invoice-line" role="listitem" key={item.id}>
              <strong>{item.inventoryItemNameSnapshot ?? item.description}</strong>
              <span>{item.quantity}</span>
              <span>{formatMoney(item.unitPrice, currency)}</span>
              <span>{formatMoney(item.discountAmount, currency)}</span>
              <strong>
                {formatMoney(
                  unitsToDecimal(
                    lineSubtotal(item.quantity, item.unitPrice) - moneyUnits(item.discountAmount),
                    4n,
                    false,
                  ),
                  currency,
                )}
              </strong>
            </div>
          ))}
        </div>
        <div className="invoice-totals">
          <div>
            <span>Subtotal</span>
            <strong>{formatMoney(invoice.subtotal, currency)}</strong>
          </div>
          <div>
            <span>Descuentos</span>
            <strong>−{formatMoney(invoice.discountTotal, currency)}</strong>
          </div>
          <div className="commercial-grand-total">
            <span>Total</span>
            <strong>{formatMoney(invoice.total, currency)}</strong>
          </div>
        </div>
        <section className="invoice-payments">
          <h3>Medios de pago</h3>
          {invoice.payments.map((payment) => (
            <div className="commercial-total-line" key={payment.id}>
              <span>
                {PAYMENT_METHOD_LABEL[payment.method]}
                {payment.status === 'VOIDED' ? ' · Anulado' : ''}
              </span>
              <strong>{formatMoney(payment.amount, currency)}</strong>
            </div>
          ))}
        </section>
        {invoice.status === 'VOIDED' ? (
          <p className="invoice-void-note">
            Comprobante anulado{invoice.voidReason ? `: ${invoice.voidReason}` : ''}
          </p>
        ) : null}
        <p className="invoice-reference">
          Venta relacionada: <Link to={`/ventas/${invoice.saleId}`}>Ver venta</Link>
        </p>
      </Card>
    </div>
  );
}
