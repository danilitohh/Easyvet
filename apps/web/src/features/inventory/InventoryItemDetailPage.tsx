import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  inventoryItemDetailSchema,
  type InventoryItemDetail as InventoryItemDetailModel,
} from '@veterinary-saas/contracts';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { EasyvetIcon } from '../../components/icons/EasyvetIcon';
import { agendaApi } from '../agenda/agendaApi';
import { ResourceError } from '../shared/ResourceFeedback';
import { useActiveOrganizationId } from '../shared/hooks';
import { useInventoryMutationGuard, useInventoryResource } from './useInventoryResources';
import { INVENTORY_MUTATED_EVENT, inventoryApi } from './inventoryApi';
import { InventoryOperationDialog, type InventoryOperation } from './InventoryOperationDialog';
import {
  INVENTORY_ITEM_TYPE_LABEL,
  INVENTORY_MOVEMENT_LABEL,
  displayCivilDate,
  displayInventoryInstant,
  displayQuantity,
  inventoryExpiryLabel,
} from './inventoryUtils';
import './inventory.css';

// Tenant and resource identity remount the detail screen, clearing any stale action or archive dialog.
export function InventoryItemDetailPage() {
  const { itemId } = useParams();
  const organizationId = useActiveOrganizationId();
  if (!itemId)
    return (
      <EmptyState
        title="Artículo no encontrado"
        description="La dirección no identifica un artículo."
      />
    );
  return <InventoryItemDetail key={`${organizationId ?? 'none'}:${itemId}`} itemId={itemId} />;
}

function InventoryItemDetail({ itemId }: { itemId: string }) {
  const organizationId = useActiveOrganizationId();
  const canUpdate = useCan(PERMISSION.INVENTORY_ITEMS_UPDATE);
  const canArchive = useCan(PERMISSION.INVENTORY_ITEMS_ARCHIVE);
  const canMove = useCan(PERMISSION.INVENTORY_MOVEMENTS_CREATE);
  const canAdjust = useCan(PERMISSION.INVENTORY_ADJUSTMENTS_CREATE);
  const canTransfer = useCan(PERMISSION.INVENTORY_TRANSFERS_CREATE);
  const guard = useInventoryMutationGuard();
  const [operation, setOperation] = useState<InventoryOperation | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveError, setArchiveError] = useState<unknown>(null);
  const [archiving, setArchiving] = useState(false);
  const [additionalBatches, setAdditionalBatches] = useState<
    InventoryItemDetailModel['stock']['batches']
  >([]);
  const [batchPage, setBatchPage] = useState(1);
  const [loadingMoreBatches, setLoadingMoreBatches] = useState(false);
  const [batchError, setBatchError] = useState<unknown>(null);
  const detail = useInventoryResource(`item-detail:${itemId}`, true, async (signal) => {
    const [item, stock, movements] = await Promise.all([
      inventoryApi.findItem(itemId, signal),
      inventoryApi.itemStock(itemId, { page: 1, pageSize: 100 }, signal),
      inventoryApi.movements({ inventoryItemId: itemId, page: 1, pageSize: 10 }, signal),
    ]);
    return inventoryItemDetailSchema.parse({ ...item, stock, recentMovements: movements.data });
  });
  const locations = useInventoryResource('locations', true, (signal) =>
    agendaApi.listLocations(signal),
  );

  const reloadDetail = detail.reload;
  const reloadWithFreshBatches = useCallback(() => {
    setAdditionalBatches([]);
    setBatchPage(1);
    setBatchError(null);
    reloadDetail();
  }, [reloadDetail]);

  useEffect(() => {
    setAdditionalBatches([]);
    setBatchPage(1);
    setBatchError(null);
  }, [itemId, organizationId]);

  useEffect(() => {
    const reload = () => reloadWithFreshBatches();
    window.addEventListener(INVENTORY_MUTATED_EVENT, reload);
    return () => window.removeEventListener(INVENTORY_MUTATED_EVENT, reload);
  }, [reloadWithFreshBatches]);

  const item = detail.data;
  const isArchived = item?.status === 'ARCHIVED';
  const hasStock = item?.stock.totalStock !== undefined && !isZero(item.stock.totalStock);
  const displayedBatches = item ? [...item.stock.batches, ...additionalBatches] : [];

  const confirmArchive = async () => {
    if (!canArchive || !item || hasStock || archiving) return;
    setArchiving(true);
    setArchiveError(null);
    try {
      await inventoryApi.archiveItem(item.id, guard.signal);
      if (!guard.isCurrent()) return;
      window.dispatchEvent(new Event(INVENTORY_MUTATED_EVENT));
      setArchiveOpen(false);
      detail.reload();
    } catch (error) {
      if (guard.isCurrent()) setArchiveError(error);
    } finally {
      if (guard.isCurrent()) setArchiving(false);
    }
  };

  const loadMoreBatches = async () => {
    if (!item || loadingMoreBatches || batchPage >= item.stock.batchPagination.totalPages) return;
    setLoadingMoreBatches(true);
    setBatchError(null);
    try {
      const next = await inventoryApi.itemStock(
        itemId,
        { page: batchPage + 1, pageSize: 100 },
        guard.signal,
      );
      if (!guard.isCurrent()) return;
      setAdditionalBatches((current) => [...current, ...next.batches]);
      setBatchPage(next.batchPagination.page);
    } catch (error) {
      if (guard.isCurrent()) setBatchError(error);
    } finally {
      if (guard.isCurrent()) setLoadingMoreBatches(false);
    }
  };

  if (detail.loading && !detail.data) {
    return <LoadingState label="Cargando artículo, lotes e historial" />;
  }
  if (detail.error) {
    return (
      <div className="page-stack inventory-page">
        <PageHeader
          eyebrow="Inventario · Detalle"
          title="Detalle del artículo"
          description="Consulta del artículo dentro de la organización activa."
        />
        <ResourceError
          error={detail.error}
          fallback="No fue posible cargar el artículo."
          onRetry={detail.reload}
        />
      </div>
    );
  }
  if (!item) return null;

  return (
    <div className="page-stack inventory-page inventory-detail-page">
      <PageHeader
        eyebrow="Inventario · Detalle"
        title={item.name}
        description={`${INVENTORY_ITEM_TYPE_LABEL[item.itemType]} · ${item.sku ?? 'Sin SKU'} · Unidad base: ${item.baseUnit}`}
        action={
          <div className="inventory-detail-actions">
            {canUpdate && !isArchived ? (
              <Button as={Link} to={`/inventario/${item.id}/editar`} variant="secondary">
                Editar artículo
              </Button>
            ) : null}
            {canMove && !isArchived ? (
              <>
                <Button type="button" onClick={() => setOperation('RECEIPT')}>
                  Recibir stock
                </Button>
                <Button type="button" variant="secondary" onClick={() => setOperation('ISSUE')}>
                  Registrar salida
                </Button>
              </>
            ) : null}
            {canAdjust && !isArchived ? (
              <Button type="button" variant="secondary" onClick={() => setOperation('ADJUSTMENT')}>
                Ajustar inventario
              </Button>
            ) : null}
            {canTransfer && !isArchived ? (
              <Button type="button" variant="secondary" onClick={() => setOperation('TRANSFER')}>
                Trasladar
              </Button>
            ) : null}
            {canArchive && !isArchived ? (
              <Button
                type="button"
                variant="danger"
                disabled={hasStock}
                onClick={() => setArchiveOpen(true)}
              >
                Archivar
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="inventory-back-link">
        <Link to="/inventario">
          <EasyvetIcon name="arrow-left" size={16} />
          <span>Volver al inventario</span>
        </Link>
      </div>
      {isArchived ? (
        <Alert tone="warning" role="status">
          Artículo archivado. El historial permanece disponible y no admite nuevos movimientos.
        </Alert>
      ) : null}
      {canArchive && !isArchived && hasStock ? (
        <p className="inventory-footnote">
          Para archivar, la existencia total debe llegar a cero en todas las sedes.
        </p>
      ) : null}

      <section className="inventory-detail-summary" aria-label="Existencias del artículo">
        <Card className="inventory-total-card">
          <p className="section-kicker">Stock total organización</p>
          <strong>
            {displayQuantity(item.stock.totalStock)} <span>{item.baseUnit}</span>
          </strong>
          <small>Calculado desde los movimientos registrados</small>
        </Card>
        <div className="inventory-detail-metadata">
          <Card>
            <span>Existencia mínima por sede</span>
            <strong>
              {item.minimumStock === null
                ? 'No configurada'
                : `${displayQuantity(item.minimumStock)} ${item.baseUnit}`}
            </strong>
          </Card>
          <Card>
            <span>Control de lotes</span>
            <strong>{item.lotTracking ? 'Activado' : 'No aplica'}</strong>
          </Card>
          <Card>
            <span>Estado</span>
            <strong>{isArchived ? 'Archivado' : 'Activo'}</strong>
          </Card>
        </div>
      </section>

      <section className="inventory-detail-grid">
        <Card className="inventory-detail-panel">
          <div className="inventory-section-heading">
            <div>
              <p className="section-kicker">Por sede</p>
              <h2>Existencias por ubicación</h2>
            </div>
            <Badge tone="neutral">{`${item.stock.locations.length} sedes`}</Badge>
          </div>
          <div className="inventory-location-list">
            {item.stock.locations.map((location) => (
              <article className="inventory-location-row" key={location.clinicLocationId}>
                <div>
                  <strong>{location.locationName}</strong>
                  <small>{location.locationStatus === 'ACTIVE' ? 'Activa' : 'Inactiva'}</small>
                </div>
                <div className="inventory-location-row__quantity">
                  <strong>
                    {displayQuantity(location.stock)} {item.baseUnit}
                  </strong>
                  {location.lowStock ? <Badge tone="warning">Bajo mínimo</Badge> : null}
                </div>
              </article>
            ))}
          </div>
        </Card>

        <Card className="inventory-detail-panel">
          <div className="inventory-section-heading">
            <div>
              <p className="section-kicker">Trazabilidad</p>
              <h2>Lotes y vencimientos</h2>
            </div>
            <Badge tone="neutral">{`${item.stock.batchPagination.total} lotes`}</Badge>
          </div>
          {!item.lotTracking ? (
            <p className="inventory-muted">Este artículo no controla stock por lote.</p>
          ) : null}
          {item.lotTracking && item.stock.batchPagination.total === 0 ? (
            <p className="inventory-muted">
              Aún no hay lotes registrados. Crea uno al recibir existencias.
            </p>
          ) : null}
          {item.lotTracking ? (
            <>
              <div className="inventory-batch-list">
                {displayedBatches.map((batch) => (
                  <BatchCard key={batch.id} batch={batch} unit={item.baseUnit} />
                ))}
              </div>
              {batchError ? (
                <ResourceError error={batchError} fallback="No fue posible cargar más lotes." />
              ) : null}
              {batchPage < item.stock.batchPagination.totalPages ? (
                <div className="inventory-operation-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void loadMoreBatches()}
                    disabled={loadingMoreBatches}
                  >
                    {loadingMoreBatches ? 'Cargando lotes…' : 'Cargar más lotes'}
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </Card>
      </section>

      <Card className="inventory-detail-panel inventory-history-panel">
        <div className="inventory-section-heading">
          <div>
            <p className="section-kicker">Ledger append-only</p>
            <h2>Movimientos recientes</h2>
          </div>
          <span className="inventory-muted">
            Solo lectura · las correcciones se registran como movimientos nuevos
          </span>
        </div>
        {item.recentMovements.length === 0 ? (
          <EmptyState
            title="Sin movimientos"
            description="Las entradas, salidas, ajustes y traslados aparecerán aquí."
          />
        ) : (
          <>
            <div className="inventory-history-table-wrap">
              <table className="inventory-table inventory-history-table">
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Movimiento</th>
                    <th scope="col">Sede / lote</th>
                    <th scope="col">Cantidad</th>
                    <th scope="col">Motivo / referencia</th>
                    <th scope="col">Responsable</th>
                  </tr>
                </thead>
                <tbody>
                  {item.recentMovements.map((movement) => (
                    <tr key={movement.id}>
                      <td>{displayInventoryInstant(movement.occurredAt)}</td>
                      <td>{INVENTORY_MOVEMENT_LABEL[movement.movementType]}</td>
                      <td>
                        {movement.clinicLocationName}
                        <small>
                          {movement.batchLotNumber ? `Lote ${movement.batchLotNumber}` : 'Sin lote'}
                        </small>
                      </td>
                      <td>
                        <strong
                          className={
                            movement.quantityDelta.startsWith('-')
                              ? 'inventory-negative'
                              : 'inventory-positive'
                          }
                        >
                          {movement.quantityDelta.startsWith('-') ? '−' : '+'}
                          {displayQuantity(movement.quantityDelta.replace(/^-/, ''))}{' '}
                          {item.baseUnit}
                        </strong>
                      </td>
                      <td>
                        {movement.reason}
                        {movement.reference ? <small>{movement.reference}</small> : null}
                      </td>
                      <td>{movement.actorDisplayName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="inventory-history-mobile">
              {item.recentMovements.map((movement) => (
                <article className="inventory-history-card" key={movement.id}>
                  <div>
                    <strong>{INVENTORY_MOVEMENT_LABEL[movement.movementType]}</strong>
                    <span
                      className={
                        movement.quantityDelta.startsWith('-')
                          ? 'inventory-negative'
                          : 'inventory-positive'
                      }
                    >
                      {movement.quantityDelta.startsWith('-') ? '−' : '+'}
                      {displayQuantity(movement.quantityDelta.replace(/^-/, ''))} {item.baseUnit}
                    </span>
                  </div>
                  <small>
                    {displayInventoryInstant(movement.occurredAt)} · {movement.clinicLocationName}
                  </small>
                  <p>{movement.reason}</p>
                  {movement.reference ? <small>Referencia: {movement.reference}</small> : null}
                  <small>
                    {movement.batchLotNumber ? `Lote ${movement.batchLotNumber} · ` : ''}
                    {movement.actorDisplayName}
                  </small>
                </article>
              ))}
            </div>
          </>
        )}
      </Card>

      {operation ? (
        <InventoryOperationDialog
          item={item}
          stock={{ ...item.stock, batches: displayedBatches }}
          locations={locations.data ?? []}
          operation={operation}
          onClose={() => setOperation(null)}
          onDone={() => {
            setOperation(null);
            reloadWithFreshBatches();
          }}
          onRefresh={reloadWithFreshBatches}
        />
      ) : null}
      <Modal
        open={archiveOpen}
        title="Archivar artículo"
        description="El artículo saldrá del catálogo activo. Su ledger y sus lotes históricos se conservarán."
        eyebrow={item.name}
        onClose={() => {
          if (!archiving) setArchiveOpen(false);
        }}
      >
        <div className="inventory-archive-confirm">
          <p>¿Confirmas archivar este artículo? No se podrá reactivar en esta versión.</p>
          {hasStock ? (
            <Alert tone="warning" role="status">
              El stock debe ser cero en todas las sedes antes de archivar.
            </Alert>
          ) : null}
          {archiveError ? (
            <ResourceError error={archiveError} fallback="No fue posible archivar el artículo." />
          ) : null}
          <div className="inventory-operation-actions">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setArchiveOpen(false)}
              disabled={archiving}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              type="button"
              onClick={confirmArchive}
              disabled={hasStock || archiving}
            >
              {archiving ? 'Archivando…' : 'Confirmar archivo'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Positive checks use the decimal string itself; UI eligibility never depends on binary floating-point math.
function isZero(value: string): boolean {
  return !/[1-9]/.test(value);
}

// Batch cards show a civil date and only derived balances; expired stock remains visible and receivable.
function BatchCard({
  batch,
  unit,
}: {
  batch: InventoryItemDetailModel['stock']['batches'][number];
  unit: string;
}) {
  const tone =
    batch.expiryStatus === 'EXPIRED'
      ? 'danger'
      : batch.expiryStatus === 'EXPIRING_SOON'
        ? 'warning'
        : 'success';
  return (
    <article className="inventory-batch-card">
      <div className="inventory-batch-card__heading">
        <strong>{batch.lotNumber}</strong>
        <Badge tone={tone}>{inventoryExpiryLabel(batch.expiryStatus)}</Badge>
      </div>
      <span>Vencimiento: {displayCivilDate(batch.expiryOn)}</span>
      <strong>
        {displayQuantity(batch.totalStock)} {unit}
      </strong>
      <div className="inventory-batch-locations">
        {batch.locations.map((location) => (
          <span key={location.clinicLocationId}>
            {location.locationName}: {displayQuantity(location.stock)}
          </span>
        ))}
      </div>
      {batch.notes ? <small>{batch.notes}</small> : null}
    </article>
  );
}
