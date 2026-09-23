import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { SalePaymentMethod } from '@veterinary-saas/contracts';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { ApiError } from '../../services/apiClient';
import { useActiveOrganizationId } from '../shared/hooks';
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

type PaymentDraft = { method: SalePaymentMethod; amount: string; reference: string };
const blankPayment = (): PaymentDraft => ({ method: 'CASH', amount: '', reference: '' });

function operationalError(error: unknown): string {
  if (!(error instanceof ApiError))
    return 'No fue posible completar la operación. Inténtalo de nuevo.';
  const messages: Record<string, string> = {
    CASH_SESSION_REQUIRED: 'Abre una caja en la sede de esta venta antes de recibir efectivo.',
    INSUFFICIENT_STOCK: 'No hay existencias suficientes para completar esta venta.',
    SALE_STALE: 'La venta cambió en otra sesión. Recarga y revisa el borrador.',
    CASH_SESSION_CLOSED: 'La caja ya está cerrada y no puede recibir reversos de efectivo.',
    SALE_INVALID_STATE: 'Esta venta ya no admite esa operación.',
    SALE_INVENTORY_ITEM_ARCHIVED:
      'No se puede anular: uno de los artículos de inventario está archivado.',
    INVENTORY_BATCH_REQUIRED: 'Selecciona un lote antes de completar la venta.',
    LOCATION_INACTIVE: 'La sede de la venta ya no está activa.',
  };
  return messages[error.code ?? ''] ?? error.message;
}

// Sale detail owns payment submission and the guarded completed-to-voided lifecycle actions.
export function SaleDetailPage() {
  const { saleId = '' } = useParams();
  const organizationId = useActiveOrganizationId();
  const navigate = useNavigate();
  const canEdit = useCan(PERMISSION.SALES_UPDATE_DRAFT);
  const canComplete = useCan(PERMISSION.SALES_COMPLETE);
  const canVoid = useCan(PERMISSION.SALES_VOID);
  const canOpenCash = useCan(PERMISSION.CASH_OPEN);
  const controller = useRef(new AbortController());
  const [payments, setPayments] = useState<PaymentDraft[]>([blankPayment()]);
  const [voidReason, setVoidReason] = useState('');
  const [voidOpen, setVoidOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saleLoader = useCallback(
    (signal: AbortSignal) => commercialApi.getSale(saleId, signal),
    [saleId],
  );
  const resource = useCommercialResource(saleLoader);
  const sale = resource.data;
  const cashLoader = useCallback(
    (signal: AbortSignal) =>
      sale?.clinicLocationId
        ? commercialApi.currentCashSession(sale.clinicLocationId, signal)
        : Promise.resolve(null),
    [sale?.clinicLocationId],
  );
  const cashResource = useCommercialResource(cashLoader, Boolean(sale?.clinicLocationId));
  const paymentTotal = useMemo(
    () => payments.reduce((total, payment) => total + moneyUnits(payment.amount || '0'), 0n),
    [payments],
  );

  useEffect(() => {
    controller.current.abort();
    controller.current = new AbortController();
    setPayments([blankPayment()]);
    setVoidReason('');
    setVoidOpen(false);
    setError('');
  }, [organizationId, saleId]);

  function updatePayment(index: number, patch: Partial<PaymentDraft>) {
    setPayments((current) =>
      current.map((payment, paymentIndex) =>
        paymentIndex === index ? { ...payment, ...patch } : payment,
      ),
    );
  }

  async function complete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sale) return;
    setError('');
    if (paymentTotal !== moneyUnits(sale.grandTotal))
      return setError('La suma de los medios de pago debe ser exactamente igual al total.');
    if (payments.some((payment) => !payment.amount || moneyUnits(payment.amount) <= 0n))
      return setError('Cada medio de pago debe tener un importe mayor que cero.');
    if (payments.some((payment) => payment.method === 'CASH') && !cashResource.data)
      return setError('Abre una caja en esta sede antes de cobrar en efectivo.');
    setBusy(true);
    try {
      const result = await commercialApi.completeSale(
        sale.id,
        {
          expectedVersion: sale.version,
          payments: payments
            .filter((payment) => moneyUnits(payment.amount) > 0n)
            .map(({ method, amount, reference }) => ({
              method,
              amount,
              ...(reference.trim() ? { reference: reference.trim() } : {}),
            })),
        },
        controller.current.signal,
      );
      resource.reload();
      if (result.invoice) navigate(`/facturacion/${result.invoice.id}`);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setError(operationalError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function voidSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sale) return;
    setBusy(true);
    setError('');
    try {
      await commercialApi.voidSale(
        sale.id,
        { expectedVersion: sale.version, reason: voidReason.trim() },
        controller.current.signal,
      );
      setVoidOpen(false);
      setVoidReason('');
      resource.reload();
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setError(operationalError(caught));
    } finally {
      setBusy(false);
    }
  }

  if (!sale)
    return (
      <div className="page-stack commercial-page">
        <CommercialHeader title="Venta" description="Detalle del registro comercial." />
        <CommercialState
          loading={resource.loading}
          error={resource.error}
          empty={false}
          retry={resource.reload}
        />
      </div>
    );
  const currency = sale.currencyCode;
  return (
    <div className="page-stack commercial-page">
      <CommercialHeader
        title={`Venta · ${sale.clinicLocationName}`}
        description={`${sale.customerNameSnapshot ?? 'Consumidor final'}${sale.patientNameSnapshot ? ` · ${sale.patientNameSnapshot}` : ''}`}
        action={<BackLink to="/ventas">Todas las ventas</BackLink>}
      />
      {error ? (
        <Alert tone="error" role="alert">
          {error}
          {error.includes('Abre una caja') && canOpenCash ? (
            <>
              {' '}
              <Link to="/caja">Ir a Caja</Link>
            </>
          ) : null}
        </Alert>
      ) : null}
      <Card className="commercial-section commercial-sale-summary">
        <div>
          <span>Estado</span>
          <StatusPill status={sale.status} />
        </div>
        <div>
          <span>Creada</span>
          <strong>
            {new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
              new Date(sale.createdAt),
            )}
          </strong>
        </div>
        <div>
          <span>Sede</span>
          <strong>{sale.clinicLocationName}</strong>
        </div>
        <div>
          <span>Total</span>
          <strong>{formatMoney(sale.grandTotal, currency)}</strong>
        </div>
        {sale.invoice ? (
          <div>
            <span>Comprobante</span>
            <Link to={`/facturacion/${sale.invoice.id}`}>{sale.invoice.documentNumber}</Link>
          </div>
        ) : null}
      </Card>
      <Card className="commercial-section">
        <h2>Conceptos</h2>
        <div className="commercial-list">
          {sale.items.map((item) => (
            <div className="commercial-row commercial-row--static" key={item.id}>
              <span className="commercial-row__main">
                <strong>{item.inventoryItemNameSnapshot ?? item.description}</strong>
                <small>
                  {item.quantity} × {formatMoney(item.unitPrice, currency)}
                  {item.discountAmount !== '0'
                    ? ` · descuento ${formatMoney(item.discountAmount, currency)}`
                    : ''}
                </small>
              </span>
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
        <div className="commercial-total-line">
          <span>Subtotal</span>
          <strong>{formatMoney(sale.subtotal, currency)}</strong>
        </div>
        <div className="commercial-total-line">
          <span>Descuentos</span>
          <strong>−{formatMoney(sale.discountTotal, currency)}</strong>
        </div>
        <div className="commercial-total-line commercial-grand-total">
          <span>Total</span>
          <strong>{formatMoney(sale.grandTotal, currency)}</strong>
        </div>
      </Card>
      {sale.payments.length ? (
        <Card className="commercial-section">
          <h2>Pagos</h2>
          <div className="commercial-list">
            {sale.payments.map((payment) => (
              <div className="commercial-row commercial-row--static" key={payment.id}>
                <span className="commercial-row__main">
                  <strong>{PAYMENT_METHOD_LABEL[payment.method]}</strong>
                  <small>
                    {payment.status === 'VOIDED'
                      ? 'Anulado'
                      : new Intl.DateTimeFormat('es-CO', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(payment.paidAt))}
                    {payment.reference ? ` · ${payment.reference}` : ''}
                  </small>
                </span>
                <strong>{formatMoney(payment.amount, currency)}</strong>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
      {sale.voidReason ? <Alert tone="warning">Venta anulada: {sale.voidReason}</Alert> : null}
      {sale.status === 'DRAFT' && canEdit ? (
        <div className="commercial-actions">
          <Button as={Link} variant="secondary" to={`/ventas/${sale.id}/editar`}>
            Editar borrador
          </Button>
        </div>
      ) : null}
      {sale.status === 'DRAFT' && canComplete ? (
        <Card className="commercial-section">
          <h2>Cobrar y completar</h2>
          <p>Los pagos, el inventario y el comprobante se registrarán en una sola operación.</p>
          {payments.map((payment, index) => (
            <div className="commercial-payment-row" key={`payment-${index}`}>
              <label className="commercial-field">
                <span>Medio</span>
                <Select
                  value={payment.method}
                  onChange={(event) =>
                    updatePayment(index, { method: event.target.value as SalePaymentMethod })
                  }
                >
                  <option value="CASH">Efectivo</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="OTHER">Otro medio</option>
                </Select>
              </label>
              <label className="commercial-field">
                <span>Importe · {currency}</span>
                <input
                  className="input"
                  inputMode="decimal"
                  pattern="[0-9]+([.][0-9]{1,4})?"
                  value={payment.amount}
                  onChange={(event) => updatePayment(index, { amount: event.target.value })}
                />
              </label>
              <label className="commercial-field">
                <span>Referencia (opcional)</span>
                <input
                  className="input"
                  maxLength={500}
                  value={payment.reference}
                  onChange={(event) => updatePayment(index, { reference: event.target.value })}
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                disabled={payments.length === 1}
                onClick={() =>
                  setPayments((current) =>
                    current.filter((_, paymentIndex) => paymentIndex !== index),
                  )
                }
              >
                Quitar
              </Button>
            </div>
          ))}
          <div className="commercial-payment-footer">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPayments((current) => [...current, blankPayment()])}
            >
              Agregar medio de pago
            </Button>
            <p>
              Pagos registrados:{' '}
              <strong>{formatMoney(unitsToDecimal(paymentTotal, 4n, false), currency)}</strong>
            </p>
          </div>
          {payments.some((payment) => payment.method === 'CASH') && !cashResource.data ? (
            <Alert tone="warning">
              No hay caja abierta en esta sede.
              {canOpenCash ? (
                <>
                  {' '}
                  <Link to="/caja">Abrir caja</Link>
                </>
              ) : null}
            </Alert>
          ) : null}
          <form onSubmit={(event) => void complete(event)} className="commercial-inline-form">
            <Button type="submit" disabled={busy || cashResource.loading}>
              {busy ? 'Procesando…' : 'Cobrar y completar venta'}
            </Button>
          </form>
        </Card>
      ) : null}
      {sale.status === 'COMPLETED' && canVoid ? (
        <div className="commercial-actions">
          <Button variant="danger" onClick={() => setVoidOpen(true)}>
            Anular venta
          </Button>
        </div>
      ) : null}
      {voidOpen ? (
        <div className="commercial-dialog-backdrop">
          <section
            className="commercial-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="void-sale-title"
          >
            <h2 id="void-sale-title">Anular venta</h2>
            <p>
              Se revertirá el stock y se anulará el comprobante. El efectivo solo se revertirá si la
              caja sigue abierta. No se procesan reembolsos de tarjeta o banco.
            </p>
            <form onSubmit={(event) => void voidSale(event)}>
              <label className="commercial-field">
                <span>Motivo de anulación</span>
                <textarea
                  className="input input--textarea"
                  required
                  maxLength={1000}
                  value={voidReason}
                  onChange={(event) => setVoidReason(event.target.value)}
                />
              </label>
              <div className="commercial-actions">
                <Button type="button" variant="secondary" onClick={() => setVoidOpen(false)}>
                  Volver
                </Button>
                <Button variant="danger" type="submit" disabled={busy || !voidReason.trim()}>
                  {busy ? 'Anulando…' : 'Confirmar anulación'}
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
