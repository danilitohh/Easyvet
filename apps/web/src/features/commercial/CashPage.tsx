import type { FormEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CashSession, CashMovementType } from '@veterinary-saas/contracts';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { ApiError } from '../../services/apiClient';
import { agendaApi } from '../agenda/agendaApi';
import { useActiveOrganizationId } from '../shared/hooks';
import { commercialApi } from './commercialApi';
import { CommercialHeader, CommercialState, StatusPill } from './CommercialPrimitives';
import { currentLocalDateTime, formatMoney, moneyUnits, unitsToDecimal } from './commercialUtils';
import { useCommercialResource } from './useCommercialResource';
import './commercial.css';

const MOVEMENT_LABEL: Record<CashMovementType, string> = {
  SALE_PAYMENT: 'Pago de venta',
  SALE_VOID_REVERSAL: 'Reversión de venta',
  MANUAL_IN: 'Entrada manual',
  MANUAL_OUT: 'Salida manual',
};

// Cash operations stay scoped to one active location and use server versions for every write.
export function CashPage() {
  const organizationId = useActiveOrganizationId();
  const canOpen = useCan(PERMISSION.CASH_OPEN);
  const canMove = useCan(PERMISSION.CASH_MOVEMENTS);
  const canClose = useCan(PERMISSION.CASH_CLOSE);
  const [locationId, setLocationId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [openingAmount, setOpeningAmount] = useState('0');
  const [openingNotes, setOpeningNotes] = useState('');
  const [movementType, setMovementType] = useState<'MANUAL_IN' | 'MANUAL_OUT'>('MANUAL_IN');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [movementReference, setMovementReference] = useState('');
  const [movementDate, setMovementDate] = useState(currentLocalDateTime);
  const [countedAmount, setCountedAmount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mutationController = useRef(new AbortController());
  const locationsLoader = useCallback((signal: AbortSignal) => agendaApi.listLocations(signal), []);
  const organizationLoader = useCallback(
    (signal: AbortSignal) => agendaApi.currentOrganization(signal),
    [],
  );
  const locations = useCommercialResource(locationsLoader);
  const organization = useCommercialResource(organizationLoader);
  const currentLoader = useCallback(
    (signal: AbortSignal) =>
      locationId ? commercialApi.currentCashSession(locationId, signal) : Promise.resolve(null),
    [locationId],
  );
  const current = useCommercialResource(currentLoader, Boolean(locationId));
  const selectedId = selectedSessionId || current.data?.id || '';
  const detailLoader = useCallback(
    (signal: AbortSignal) =>
      selectedId ? commercialApi.getCashSession(selectedId, signal) : Promise.resolve(null),
    [selectedId],
  );
  const detail = useCommercialResource(detailLoader, Boolean(selectedId));
  const movementsLoader = useCallback(
    (signal: AbortSignal) =>
      selectedId
        ? commercialApi.listCashMovements(selectedId, { page: 1, pageSize: 100 }, signal)
        : Promise.resolve({
            data: [],
            pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
          }),
    [selectedId],
  );
  const movements = useCommercialResource(movementsLoader, Boolean(selectedId));
  const historyLoader = useCallback(
    (signal: AbortSignal) =>
      locationId
        ? commercialApi.listCashSessions(
            { clinicLocationId: locationId, page: 1, pageSize: 20 },
            signal,
          )
        : Promise.resolve({
            data: [],
            pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
          }),
    [locationId],
  );
  const history = useCommercialResource(historyLoader, Boolean(locationId));
  const session = detail.data;
  const currency = organization.data?.currencyCode ?? '—';
  const differencePreview =
    session && countedAmount && /^\d{1,16}(?:\.\d{1,4})?$/.test(countedAmount)
      ? unitsToDecimal(
          moneyUnits(countedAmount) - moneyUnits(session.expectedCashAmount),
          4n,
          false,
        )
      : null;

  useEffect(() => {
    mutationController.current.abort();
    mutationController.current = new AbortController();
    setLocationId('');
    setSelectedSessionId('');
    setOpeningAmount('0');
    setOpeningNotes('');
    setMovementAmount('');
    setMovementReason('');
    setMovementReference('');
    setCountedAmount('');
    setClosingNotes('');
    setError('');
  }, [organizationId]);

  useEffect(() => {
    if (current.data?.id && !selectedSessionId) setSelectedSessionId(current.data.id);
  }, [current.data?.id, selectedSessionId]);

  function refresh() {
    current.reload();
    history.reload();
    detail.reload();
    movements.reload();
  }

  async function perform(action: (signal: AbortSignal) => Promise<unknown>, success: () => void) {
    setBusy(true);
    setError('');
    try {
      await action(mutationController.current.signal);
      success();
      refresh();
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      if (caught instanceof ApiError && caught.code === 'CASH_INSUFFICIENT_BALANCE') {
        setError('La salida supera el efectivo disponible. Ajusta el importe y vuelve a revisar.');
        return;
      }
      if (caught instanceof ApiError && caught.status === 409)
        setError(
          'La caja cambió mientras trabajabas. Actualiza la vista y revisa los movimientos antes de repetir.',
        );
      else
        setError(
          caught instanceof ApiError ? caught.message : 'No fue posible guardar el movimiento.',
        );
    } finally {
      setBusy(false);
    }
  }

  function openCash(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!locationId) return setError('Selecciona una sede.');
    void perform(
      (signal) =>
        commercialApi.openCash(
          {
            clinicLocationId: locationId,
            openingCashAmount: openingAmount,
            notes: openingNotes.trim() || null,
          },
          signal,
        ),
      () => {
        setOpeningNotes('');
      },
    );
  }

  function postMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || session.status !== 'OPEN')
      return setError('No hay una caja abierta seleccionada.');
    void perform(
      (signal) =>
        commercialApi.createCashMovement(
          session.id,
          {
            expectedVersion: session.version,
            type: movementType,
            amount: movementAmount,
            reason: movementReason.trim(),
            reference: movementReference.trim() || null,
            occurredAt: new Date(movementDate).toISOString(),
          },
          signal,
        ),
      () => {
        setMovementAmount('');
        setMovementReason('');
        setMovementReference('');
        setMovementDate(currentLocalDateTime());
      },
    );
  }

  function closeCash(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || session.status !== 'OPEN')
      return setError('No hay una caja abierta seleccionada.');
    void perform(
      (signal) =>
        commercialApi.closeCash(
          session.id,
          {
            expectedVersion: session.version,
            countedCashAmount: countedAmount,
            notes: closingNotes.trim() || null,
          },
          signal,
        ),
      () => {
        setCountedAmount('');
        setClosingNotes('');
      },
    );
  }

  const activeLocation = (locations.data ?? []).find((location) => location.id === locationId);
  const openSession = current.data;
  return (
    <div className="page-stack commercial-page">
      <CommercialHeader
        title="Caja"
        description="Controla efectivo por sede, registra movimientos y cierra cada turno con un arqueo."
      />
      {error ? (
        <Alert tone="error" role="alert">
          {error}
        </Alert>
      ) : null}
      <section className="commercial-toolbar">
        <label className="commercial-field">
          <span>Sede</span>
          <Select
            value={locationId}
            onChange={(event) => {
              setLocationId(event.target.value);
              setSelectedSessionId('');
              setError('');
            }}
          >
            <option value="">Selecciona una sede</option>
            {(locations.data ?? [])
              .filter((location) => location.status === 'ACTIVE' || location.status === 'ARCHIVED')
              .map((location) => (
                <option value={location.id} key={location.id}>
                  {location.name}
                  {location.status === 'ACTIVE' ? '' : ' · Histórica'}
                </option>
              ))}
          </Select>
        </label>
        {openSession ? <StatusPill status={openSession.status} /> : null}
      </section>
      {locations.loading ? (
        <p role="status">Cargando sedes…</p>
      ) : locations.error ? (
        <CommercialState
          loading={false}
          error={locations.error}
          empty={false}
          retry={locations.reload}
        />
      ) : null}
      {locationId && activeLocation ? (
        <>
          {current.error ? (
            <CommercialState
              loading={false}
              error={current.error}
              empty={false}
              retry={current.reload}
            />
          ) : null}
          {openSession ? (
            <Card className="commercial-section commercial-cash-current">
              <div className="commercial-section-heading">
                <div>
                  <h2>Caja abierta · {activeLocation.name}</h2>
                  <p>
                    Abierta{' '}
                    {new Intl.DateTimeFormat('es-CO', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(openSession.openedAt))}
                  </p>
                </div>
                <StatusPill status="OPEN" />
              </div>
              <div className="commercial-cash-metrics">
                <div>
                  <span>Base de apertura</span>
                  <strong>{formatMoney(openSession.openingCashAmount, currency)}</strong>
                </div>
                <div>
                  <span>Efectivo esperado</span>
                  <strong>{formatMoney(openSession.expectedCashAmount, currency)}</strong>
                </div>
                <div>
                  <span>Versión</span>
                  <strong>{openSession.version}</strong>
                </div>
              </div>
            </Card>
          ) : !current.loading && canOpen ? (
            <Card className="commercial-section">
              <h2>Abrir caja · {activeLocation.name}</h2>
              <form className="form-grid form-grid--two" onSubmit={openCash}>
                <label className="commercial-field">
                  <span>Base inicial · {currency}</span>
                  <input
                    className="input"
                    required
                    inputMode="decimal"
                    pattern="[0-9]+([.][0-9]{1,4})?"
                    value={openingAmount}
                    onChange={(event) => setOpeningAmount(event.target.value)}
                  />
                </label>
                <label className="commercial-field">
                  <span>Nota (opcional)</span>
                  <input
                    className="input"
                    maxLength={2000}
                    value={openingNotes}
                    onChange={(event) => setOpeningNotes(event.target.value)}
                  />
                </label>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Abriendo…' : 'Abrir caja'}
                </Button>
              </form>
            </Card>
          ) : null}
          {session ? (
            <Card className="commercial-section">
              <div className="commercial-section-heading">
                <div>
                  <h2>Movimientos</h2>
                  <p>Registro inalterable de entradas, salidas y cobros.</p>
                </div>
              </div>
              <CommercialState
                loading={movements.loading}
                error={movements.error}
                empty={
                  !movements.loading && !movements.error && (movements.data?.data.length ?? 0) === 0
                }
                retry={movements.reload}
              />
              {movements.data?.data.length ? (
                <div className="commercial-list">
                  {movements.data.data.map((movement) => (
                    <div className="commercial-row commercial-row--static" key={movement.id}>
                      <span className="commercial-row__main">
                        <strong>{MOVEMENT_LABEL[movement.movementType]}</strong>
                        <small>
                          {movement.reason ?? 'Cobro de venta'} ·{' '}
                          {new Intl.DateTimeFormat('es-CO', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(movement.occurredAt))}
                          {movement.reference ? ` · ${movement.reference}` : ''}
                        </small>
                      </span>
                      <strong
                        className={
                          movement.amountDelta.startsWith('-')
                            ? 'commercial-negative'
                            : 'commercial-positive'
                        }
                      >
                        {formatMoney(movement.amountDelta, currency)}
                      </strong>
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          ) : null}
          {session?.status === 'OPEN' && canMove ? (
            <Card className="commercial-section">
              <h2>Movimiento manual</h2>
              <form className="form-grid form-grid--three" onSubmit={postMovement}>
                <label className="commercial-field">
                  <span>Tipo</span>
                  <Select
                    value={movementType}
                    onChange={(event) =>
                      setMovementType(event.target.value as 'MANUAL_IN' | 'MANUAL_OUT')
                    }
                  >
                    <option value="MANUAL_IN">Entrada</option>
                    <option value="MANUAL_OUT">Salida</option>
                  </Select>
                </label>
                <label className="commercial-field">
                  <span>Importe · {currency}</span>
                  <input
                    className="input"
                    required
                    inputMode="decimal"
                    pattern="[0-9]+([.][0-9]{1,4})?"
                    value={movementAmount}
                    onChange={(event) => setMovementAmount(event.target.value)}
                  />
                </label>
                <label className="commercial-field">
                  <span>Fecha y hora</span>
                  <input
                    className="input"
                    required
                    type="datetime-local"
                    value={movementDate}
                    onChange={(event) => setMovementDate(event.target.value)}
                  />
                </label>
                <label className="commercial-field commercial-field--wide">
                  <span>Motivo</span>
                  <input
                    className="input"
                    required
                    maxLength={1000}
                    value={movementReason}
                    onChange={(event) => setMovementReason(event.target.value)}
                  />
                </label>
                <label className="commercial-field commercial-field--wide">
                  <span>Referencia (opcional)</span>
                  <input
                    className="input"
                    maxLength={500}
                    value={movementReference}
                    onChange={(event) => setMovementReference(event.target.value)}
                  />
                </label>
                <Button type="submit" disabled={busy}>
                  {busy
                    ? 'Guardando…'
                    : movementType === 'MANUAL_IN'
                      ? 'Registrar entrada'
                      : 'Registrar salida'}
                </Button>
              </form>
            </Card>
          ) : null}
          {session?.status === 'OPEN' && canClose ? (
            <Card className="commercial-section">
              <h2>Cerrar caja</h2>
              <form className="form-grid form-grid--two" onSubmit={closeCash}>
                <label className="commercial-field">
                  <span>Efectivo esperado</span>
                  <output className="commercial-readonly-value">
                    {formatMoney(session.expectedCashAmount, currency)}
                  </output>
                </label>
                <label className="commercial-field">
                  <span>Efectivo contado · {currency}</span>
                  <input
                    className="input"
                    required
                    inputMode="decimal"
                    pattern="[0-9]+([.][0-9]{1,4})?"
                    value={countedAmount}
                    onChange={(event) => setCountedAmount(event.target.value)}
                  />
                </label>
                {differencePreview !== null ? (
                  <p className="commercial-difference">
                    Diferencia prevista: <strong>{formatMoney(differencePreview, currency)}</strong>
                  </p>
                ) : null}
                <label className="commercial-field commercial-field--wide">
                  <span>Nota de cierre (opcional)</span>
                  <textarea
                    className="input input--textarea"
                    maxLength={2000}
                    value={closingNotes}
                    onChange={(event) => setClosingNotes(event.target.value)}
                  />
                </label>
                <Button type="submit" variant="danger" disabled={busy}>
                  {busy ? 'Cerrando…' : 'Cerrar caja'}
                </Button>
              </form>
              <p className="commercial-hint">
                El sistema recalcula el efectivo esperado al guardar. Si entra un pago o movimiento
                antes del cierre, se pedirá revisar el arqueo.
              </p>
            </Card>
          ) : null}
          <Card className="commercial-section">
            <h2>Historial de cierres</h2>
            <CommercialState
              loading={history.loading}
              error={history.error}
              empty={!history.loading && !history.error && (history.data?.data.length ?? 0) === 0}
              retry={history.reload}
            />
            {(history.data?.data ?? []).map((row: CashSession) => (
              <button
                className="commercial-row commercial-row--button"
                key={row.id}
                type="button"
                aria-pressed={selectedId === row.id}
                onClick={() => setSelectedSessionId(row.id)}
              >
                <span className="commercial-row__main">
                  <strong>{row.clinicLocationName}</strong>
                  <small>
                    {new Intl.DateTimeFormat('es-CO', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(row.openedAt))}
                  </small>
                </span>
                <span className="commercial-row__meta">
                  <StatusPill status={row.status} />
                  <strong>{formatMoney(row.expectedCashAmount, currency)}</strong>
                </span>
              </button>
            ))}
          </Card>
          {session?.status === 'CLOSED' ? (
            <Card className="commercial-section">
              <h2>Cierre de caja</h2>
              <div className="commercial-cash-metrics">
                <div>
                  <span>Efectivo esperado</span>
                  <strong>{formatMoney(session.expectedCashAmount, currency)}</strong>
                </div>
                <div>
                  <span>Efectivo contado</span>
                  <strong>{formatMoney(session.countedCashAmount ?? '0', currency)}</strong>
                </div>
                <div>
                  <span>Diferencia</span>
                  <strong>{formatMoney(session.differenceAmount ?? '0', currency)}</strong>
                </div>
              </div>
              <p className="commercial-hint">
                Cierre{' '}
                {session.closedAt
                  ? new Intl.DateTimeFormat('es-CO', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(session.closedAt))
                  : ''}
                . Esta caja es de solo lectura.
              </p>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
