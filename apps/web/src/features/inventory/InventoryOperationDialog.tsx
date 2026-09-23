import { useState, type FormEvent } from 'react';
import type {
  CreateInventoryMovementRequest,
  CreateInventoryTransferRequest,
  InventoryBatchSummary,
  InventoryItem,
  InventoryItemStockDetail,
  LocationResponse,
} from '@veterinary-saas/contracts';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { ApiError } from '../../services/apiClient';
import { ResourceError } from '../shared/ResourceFeedback';
import { useActiveOrganizationId } from '../shared/hooks';
import { useInventoryMutationGuard } from './useInventoryResources';
import { INVENTORY_MUTATED_EVENT, inventoryApi } from './inventoryApi';
import { currentLocalDateTimeInput, displayQuantity, inventoryExpiryLabel } from './inventoryUtils';
import './inventory.css';

export type InventoryOperation = 'RECEIPT' | 'ISSUE' | 'ADJUSTMENT' | 'TRANSFER';

type InventoryOperationDialogProps = {
  item: InventoryItem;
  stock: InventoryItemStockDetail;
  locations: LocationResponse[];
  operation: InventoryOperation;
  onClose: () => void;
  onDone: () => void;
  onRefresh: () => void;
};

const OPERATION_COPY: Record<InventoryOperation, { title: string; description: string }> = {
  RECEIPT: {
    title: 'Recibir existencias',
    description: 'Registra una entrada manual en el ledger.',
  },
  ISSUE: {
    title: 'Registrar salida',
    description: 'La cantidad se ingresa positiva; el sistema registra una salida negativa.',
  },
  ADJUSTMENT: {
    title: 'Ajustar inventario',
    description: 'Añade o retira una diferencia de conteo como movimiento compensatorio.',
  },
  TRANSFER: {
    title: 'Trasladar entre sedes',
    description: 'Se crearán juntos el envío y la recepción del traslado.',
  },
};

// Dialog records only manual ledger operations and leaves stock validation to the serialized API transaction.
export function InventoryOperationDialog({
  item,
  stock,
  locations,
  operation,
  onClose,
  onDone,
  onRefresh,
}: InventoryOperationDialogProps) {
  const organizationId = useActiveOrganizationId();
  return (
    <InventoryOperationForm
      key={`${organizationId ?? 'none'}:${item.id}:${operation}`}
      item={item}
      stock={stock}
      locations={locations}
      operation={operation}
      onClose={onClose}
      onDone={onDone}
      onRefresh={onRefresh}
    />
  );
}

function InventoryOperationForm(props: InventoryOperationDialogProps) {
  const { item, stock, locations, operation, onClose, onDone, onRefresh } = props;
  const guard = useInventoryMutationGuard();
  const [locationId, setLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [occurredAt, setOccurredAt] = useState(currentLocalDateTimeInput);
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [adjustmentDirection, setAdjustmentDirection] = useState<'IN' | 'OUT'>('IN');
  const [batchChoice, setBatchChoice] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [expiryOn, setExpiryOn] = useState('');
  const [batchNotes, setBatchNotes] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [raceError, setRaceError] = useState(false);
  const activeLocations = locations.filter((location) => location.status === 'ACTIVE');
  const isTransfer = operation === 'TRANSFER';
  const isReceipt = operation === 'RECEIPT';
  const isAdjustment = operation === 'ADJUSTMENT';
  const needsReason = !isReceipt && !isTransfer;
  const selectedLocationStock =
    stock.locations.find((entry) => entry.clinicLocationId === locationId)?.stock ?? '0';
  const selectedBatch = stock.batches.find((batch) => batch.id === batchChoice);
  const availableAtLocation = selectedBatch
    ? (selectedBatch.locations.find((entry) => entry.clinicLocationId === locationId)?.stock ?? '0')
    : selectedLocationStock;
  const sourceLocationStock = isTransfer
    ? (selectedBatch?.locations.find((entry) => entry.clinicLocationId === locationId)?.stock ??
      selectedLocationStock)
    : availableAtLocation;
  const batchesForSelectedLocation = stock.batches.filter((batch) => {
    if (isReceipt) return true;
    const balance =
      batch.locations.find((entry) => entry.clinicLocationId === locationId)?.stock ?? '0';
    return hasPositiveQuantity(balance);
  });

  const closeSafely = () => {
    if (!saving) onClose();
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setRaceError(false);
    const instant = new Date(occurredAt);
    if (!Number.isFinite(instant.valueOf())) {
      setError(new Error('Ingresa una fecha y hora válidas.'));
      setSaving(false);
      return;
    }
    try {
      if (isTransfer) {
        const payload: CreateInventoryTransferRequest = {
          inventoryItemId: item.id,
          ...(item.lotTracking ? { inventoryBatchId: batchChoice } : {}),
          fromClinicLocationId: locationId,
          toClinicLocationId: toLocationId,
          quantity,
          occurredAt: instant.toISOString(),
          reason: reason.trim() || null,
        };
        await inventoryApi.transfer(payload, guard.signal);
      } else {
        const movementType: CreateInventoryMovementRequest['movementType'] = isReceipt
          ? 'RECEIPT'
          : operation === 'ISSUE'
            ? 'ISSUE'
            : adjustmentDirection === 'IN'
              ? 'ADJUSTMENT_IN'
              : 'ADJUSTMENT_OUT';
        const payload: CreateInventoryMovementRequest = {
          inventoryItemId: item.id,
          clinicLocationId: locationId,
          movementType,
          quantity,
          occurredAt: instant.toISOString(),
          ...(item.lotTracking
            ? batchChoice === 'new'
              ? {
                  newBatch: {
                    lotNumber,
                    expiryOn: expiryOn || null,
                    notes: batchNotes.trim() || null,
                  },
                }
              : { inventoryBatchId: batchChoice }
            : {}),
          ...(reason.trim() ? { reason: reason.trim() } : {}),
          ...(reference.trim() ? { reference: reference.trim() } : {}),
          ...(isReceipt && unitCost.trim() ? { unitCost: unitCost.trim() } : {}),
        };
        await inventoryApi.createMovement(payload, guard.signal);
      }
      if (!guard.isCurrent()) return;
      window.dispatchEvent(new Event(INVENTORY_MUTATED_EVENT));
      onDone();
    } catch (requestError) {
      if (!guard.isCurrent()) return;
      if (requestError instanceof ApiError && requestError.code === 'INSUFFICIENT_STOCK') {
        setRaceError(true);
        onRefresh();
      } else {
        setError(requestError);
      }
    } finally {
      if (guard.isCurrent()) setSaving(false);
    }
  };

  const copy = OPERATION_COPY[operation];
  return (
    <Modal
      open
      title={copy.title}
      description={copy.description}
      eyebrow={item.name}
      onClose={closeSafely}
    >
      <form className="inventory-operation-form" onSubmit={onSubmit}>
        {raceError ? (
          <Alert tone="warning" role="alert">
            El stock disponible cambió. Actualiza el inventario e intenta nuevamente. Las
            existencias ya se actualizaron; no reintentamos automáticamente.
          </Alert>
        ) : null}
        {error ? (
          <ResourceError error={error} fallback="No fue posible registrar el movimiento." />
        ) : null}
        {activeLocations.length === 0 ? (
          <Alert tone="warning" role="status">
            No hay sedes activas disponibles para registrar movimientos.
          </Alert>
        ) : null}

        <div className="inventory-form-grid">
          <FormField
            label={isTransfer ? 'Sede de origen' : 'Sede'}
            htmlFor="inventory-operation-location"
          >
            <Select
              id="inventory-operation-location"
              value={locationId}
              onChange={(event) => {
                setLocationId(event.target.value);
                setBatchChoice('');
              }}
              required
            >
              <option value="">Selecciona una sede</option>
              {activeLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </Select>
          </FormField>
          {isTransfer ? (
            <FormField label="Sede de destino" htmlFor="inventory-operation-destination">
              <Select
                id="inventory-operation-destination"
                value={toLocationId}
                onChange={(event) => setToLocationId(event.target.value)}
                required
              >
                <option value="">Selecciona una sede</option>
                {activeLocations
                  .filter((location) => location.id !== locationId)
                  .map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
              </Select>
            </FormField>
          ) : null}

          {isAdjustment ? (
            <FormField label="Dirección del ajuste" htmlFor="inventory-adjustment-direction">
              <Select
                id="inventory-adjustment-direction"
                value={adjustmentDirection}
                onChange={(event) => setAdjustmentDirection(event.target.value as 'IN' | 'OUT')}
              >
                <option value="IN">Aumentar existencias</option>
                <option value="OUT">Disminuir existencias</option>
              </Select>
            </FormField>
          ) : null}

          {item.lotTracking ? (
            <FormField
              label="Lote"
              htmlFor="inventory-operation-batch"
              hint="La existencia se controla por lote, no se mezclan cantidades sin lote."
            >
              <Select
                id="inventory-operation-batch"
                value={batchChoice}
                onChange={(event) => setBatchChoice(event.target.value)}
                required
              >
                <option value="">Selecciona un lote</option>
                {batchesForSelectedLocation.map((batch) => (
                  <BatchOption key={batch.id} batch={batch} />
                ))}
                {isReceipt ? <option value="new">Crear lote con esta entrada</option> : null}
              </Select>
            </FormField>
          ) : null}

          {isReceipt && item.lotTracking && batchChoice === 'new' ? (
            <>
              <FormField label="Número de lote" htmlFor="inventory-new-lot-number">
                <input
                  id="inventory-new-lot-number"
                  className="input"
                  value={lotNumber}
                  onChange={(event) => setLotNumber(event.target.value)}
                  maxLength={120}
                  required
                />
              </FormField>
              <FormField
                label="Vencimiento"
                htmlFor="inventory-new-lot-expiry"
                hint="Fecha civil YYYY-MM-DD. Se permite documentar lotes ya vencidos."
              >
                <input
                  id="inventory-new-lot-expiry"
                  className="input"
                  type="date"
                  value={expiryOn}
                  onChange={(event) => setExpiryOn(event.target.value)}
                />
              </FormField>
              <FormField label="Notas del lote (opcional)" htmlFor="inventory-new-lot-notes">
                <input
                  id="inventory-new-lot-notes"
                  className="input"
                  value={batchNotes}
                  onChange={(event) => setBatchNotes(event.target.value)}
                  maxLength={2000}
                />
              </FormField>
            </>
          ) : null}

          <FormField
            label={`Cantidad positiva (${item.baseUnit})`}
            htmlFor="inventory-operation-quantity"
            hint="Usa hasta seis decimales. El sistema determina el signo según la operación."
          >
            <input
              id="inventory-operation-quantity"
              className="input"
              type="number"
              min="0.000001"
              step="0.000001"
              inputMode="decimal"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
            />
          </FormField>
          <FormField label="Fecha y hora del movimiento" htmlFor="inventory-operation-date">
            <input
              id="inventory-operation-date"
              className="input"
              type="datetime-local"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
              required
            />
          </FormField>
          {isReceipt ? (
            <FormField
              label="Costo unitario (opcional)"
              htmlFor="inventory-operation-unit-cost"
              hint="Metadato de recepción; no es precio de venta ni costeo contable."
            >
              <input
                id="inventory-operation-unit-cost"
                className="input"
                type="number"
                min="0"
                step="0.000001"
                inputMode="decimal"
                value={unitCost}
                onChange={(event) => setUnitCost(event.target.value)}
              />
            </FormField>
          ) : null}
          <FormField
            label={needsReason ? 'Motivo' : 'Motivo (opcional)'}
            htmlFor="inventory-operation-reason"
          >
            <textarea
              id="inventory-operation-reason"
              className="input inventory-textarea"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={2000}
              rows={2}
              required={needsReason}
            />
          </FormField>
          {!isTransfer ? (
            <FormField label="Referencia (opcional)" htmlFor="inventory-operation-reference">
              <input
                id="inventory-operation-reference"
                className="input"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                maxLength={500}
              />
            </FormField>
          ) : null}
        </div>

        {(operation === 'ISSUE' || (isAdjustment && adjustmentDirection === 'OUT') || isTransfer) &&
        locationId ? (
          <p className="inventory-availability-note" role="status">
            Existencia disponible en origen:{' '}
            <strong>
              {displayQuantity(sourceLocationStock)} {item.baseUnit}
            </strong>
            . El servidor volverá a verificarla al guardar.
          </p>
        ) : null}
        <div className="inventory-operation-actions">
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={saving || !guard.organizationId || activeLocations.length === 0}
          >
            {saving
              ? 'Registrando…'
              : isTransfer
                ? 'Confirmar traslado'
                : isReceipt
                  ? 'Registrar entrada'
                  : isAdjustment
                    ? 'Registrar ajuste'
                    : 'Registrar salida'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Lot selectors display civil expiry as text to avoid parsing DATE values as browser-local instants.
function BatchOption({ batch }: { batch: InventoryBatchSummary }) {
  return (
    <option value={batch.id}>
      {batch.lotNumber} · {inventoryExpiryLabel(batch.expiryStatus)}
    </option>
  );
}

// Positive checks stay in decimal-string space instead of converting inventory quantities to Number.
function hasPositiveQuantity(value: string): boolean {
  return !value.startsWith('-') && /[1-9]/.test(value);
}
