import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { InventoryItemStatus, InventoryItemType } from '@veterinary-saas/contracts';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { agendaApi } from '../agenda/agendaApi';
import { ResourceError } from '../shared/ResourceFeedback';
import { useActiveOrganizationId } from '../shared/hooks';
import { useInventoryResource } from './useInventoryResources';
import { inventoryApi, INVENTORY_MUTATED_EVENT } from './inventoryApi';
import { INVENTORY_ITEM_TYPE_LABEL, displayQuantity } from './inventoryUtils';
import './inventory.css';

const ITEM_TYPES: InventoryItemType[] = ['MEDICATION', 'SUPPLY', 'RETAIL', 'OTHER'];

// The inventory dashboard labels its stock scope explicitly and treats every quantity as a projection.
export function InventoryPage() {
  const canRead = useCan(PERMISSION.INVENTORY_READ);
  const canCreate = useCan(PERMISSION.INVENTORY_ITEMS_CREATE);
  const organizationId = useActiveOrganizationId();
  const [locationId, setLocationId] = useState('');
  const [itemType, setItemType] = useState<InventoryItemType | ''>('');
  const [lowStock, setLowStock] = useState<'' | 'true' | 'false'>('');
  const [status, setStatus] = useState<InventoryItemStatus | 'ALL'>('ACTIVE');

  useEffect(() => {
    setLocationId('');
    setItemType('');
    setLowStock('');
    setStatus('ACTIVE');
  }, [organizationId]);

  const locationResource = useInventoryResource('locations', canRead, (signal) =>
    agendaApi.listLocations(signal),
  );
  const query = useMemo(
    () => ({
      page: 1,
      pageSize: 100,
      ...(locationId ? { clinicLocationId: locationId } : {}),
      ...(itemType ? { itemType } : {}),
      ...(lowStock ? { lowStock: lowStock === 'true' } : {}),
      includeArchived: status !== 'ACTIVE',
    }),
    [itemType, locationId, lowStock, status],
  );
  const stockResource = useInventoryResource(`stock:${JSON.stringify(query)}`, canRead, (signal) =>
    inventoryApi.stock(query, signal),
  );
  const summaryResource = useInventoryResource('summary', canRead, (signal) =>
    inventoryApi.summary(signal),
  );

  const reloadStock = stockResource.reload;
  const reloadSummary = summaryResource.reload;
  useEffect(() => {
    const reload = () => {
      reloadStock();
      reloadSummary();
    };
    window.addEventListener(INVENTORY_MUTATED_EVENT, reload);
    return () => window.removeEventListener(INVENTORY_MUTATED_EVENT, reload);
  }, [reloadStock, reloadSummary]);

  const items = (stockResource.data?.data ?? []).filter((row) =>
    status === 'ALL' ? true : row.item.status === status,
  );
  const isLoading = stockResource.loading || locationResource.loading;

  return (
    <div className="page-stack inventory-page">
      <PageHeader
        eyebrow="Operación · Inventario"
        title="Inventario"
        description="Control de existencias por sede, lotes y movimientos manuales. Las cantidades se calculan desde el historial de movimientos."
        action={
          canCreate ? (
            <Button as={Link} to="/inventario/nuevo">
              Nuevo artículo
            </Button>
          ) : undefined
        }
      />

      {summaryResource.error ? (
        <ResourceError
          error={summaryResource.error}
          fallback="No fue posible cargar el resumen de inventario."
          onRetry={summaryResource.reload}
        />
      ) : null}

      <section className="inventory-metrics" aria-label="Resumen de inventario">
        <MetricCard
          label="Artículos activos"
          value={summaryResource.data?.activeItems}
          detail="Catálogo vigente"
        />
        <MetricCard
          label="Bajo mínimo"
          value={summaryResource.data?.lowStockItemLocations}
          detail="Artículo y sede"
          tone="warning"
        />
        <MetricCard
          label="Lotes vencidos"
          value={summaryResource.data?.expiredBatches}
          detail="Con existencias disponibles"
          tone="danger"
        />
        <MetricCard
          label="Vencen pronto"
          value={summaryResource.data?.expiringSoonBatches}
          detail="En los próximos 30 días"
          tone="warning"
        />
      </section>

      <Card className="inventory-list-panel">
        <div className="inventory-list-heading">
          <div>
            <p className="section-kicker">Existencias derivadas</p>
            <h2>Artículos</h2>
            <p className="inventory-muted">
              {locationId
                ? 'Mostrando existencias de la sede seleccionada.'
                : 'Todas las sedes · el stock total se suma entre sedes.'}
            </p>
          </div>
          <div className="inventory-filter-grid" aria-label="Filtros de inventario">
            <label>
              <span>Sede</span>
              <Select value={locationId} onChange={(event) => setLocationId(event.target.value)}>
                <option value="">Todas las sedes</option>
                {locationResource.data
                  ?.filter((location) => location.status === 'ACTIVE')
                  .map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
              </Select>
            </label>
            <label>
              <span>Tipo</span>
              <Select
                value={itemType}
                onChange={(event) => setItemType(event.target.value as InventoryItemType | '')}
              >
                <option value="">Todos los tipos</option>
                {ITEM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {INVENTORY_ITEM_TYPE_LABEL[type]}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span>Estado de stock</span>
              <Select
                value={lowStock}
                onChange={(event) => setLowStock(event.target.value as typeof lowStock)}
              >
                <option value="">Cualquier nivel</option>
                <option value="true">Bajo mínimo</option>
                <option value="false">En o sobre mínimo</option>
              </Select>
            </label>
            <label>
              <span>Catálogo</span>
              <Select
                value={status}
                onChange={(event) => setStatus(event.target.value as InventoryItemStatus | 'ALL')}
              >
                <option value="ACTIVE">Activos</option>
                <option value="ARCHIVED">Archivados</option>
                <option value="ALL">Todos</option>
              </Select>
            </label>
          </div>
        </div>

        {stockResource.error ? (
          <ResourceError
            error={stockResource.error}
            fallback="No fue posible cargar las existencias."
            onRetry={stockResource.reload}
          />
        ) : null}
        {locationResource.error ? (
          <ResourceError
            error={locationResource.error}
            fallback="No fue posible cargar las sedes."
            onRetry={locationResource.reload}
          />
        ) : null}
        {isLoading ? <LoadingState label="Cargando artículos y existencias" /> : null}
        {!isLoading && !stockResource.error && items.length === 0 ? (
          <EmptyState
            title="No hay artículos para estos filtros"
            description="Crea un artículo para empezar a registrar entradas y consultar su historial."
            action={
              canCreate ? (
                <Button as={Link} to="/inventario/nuevo">
                  Crear artículo
                </Button>
              ) : undefined
            }
          />
        ) : null}
        {items.length > 0 ? (
          <>
            <div className="inventory-desktop-table-wrap">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th scope="col">Artículo</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Existencias</th>
                    <th scope="col">Mínimo / sede</th>
                    <th scope="col">Lotes</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.item.id}>
                      <td>
                        <Link className="inventory-item-link" to={`/inventario/${row.item.id}`}>
                          <strong>{row.item.name}</strong>
                          <small>
                            {row.item.sku ?? 'Sin SKU'} · {row.item.baseUnit}
                          </small>
                        </Link>
                      </td>
                      <td>{INVENTORY_ITEM_TYPE_LABEL[row.item.itemType]}</td>
                      <td>
                        <strong>{displayQuantity(row.stock)}</strong> {row.item.baseUnit}
                      </td>
                      <td>
                        {row.item.minimumStock === null
                          ? 'Sin mínimo'
                          : `${displayQuantity(row.item.minimumStock)} ${row.item.baseUnit}`}
                        {!locationId && row.lowStock ? (
                          <small className="inventory-muted">
                            · {row.lowStockLocations} sedes bajo mínimo
                          </small>
                        ) : null}
                      </td>
                      <td>{row.item.lotTracking ? 'Por lote' : 'Sin lote'}</td>
                      <td>
                        {row.lowStock ? (
                          <Badge tone="warning">Bajo mínimo</Badge>
                        ) : (
                          <Badge tone="success">Disponible</Badge>
                        )}
                        {row.item.status === 'ARCHIVED' ? (
                          <Badge tone="neutral">Archivado</Badge>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="inventory-mobile-list">
              {items.map((row) => (
                <Link
                  className="inventory-mobile-card"
                  to={`/inventario/${row.item.id}`}
                  key={row.item.id}
                >
                  <span className="inventory-mobile-card__heading">
                    <strong>{row.item.name}</strong>
                    {row.lowStock ? <Badge tone="warning">Bajo mínimo</Badge> : null}
                  </span>
                  <span>
                    {INVENTORY_ITEM_TYPE_LABEL[row.item.itemType]} · {row.item.sku ?? 'Sin SKU'}
                  </span>
                  <span className="inventory-mobile-card__stock">
                    {displayQuantity(row.stock)} {row.item.baseUnit}
                  </span>
                  <span>
                    Mínimo:{' '}
                    {row.item.minimumStock === null
                      ? 'no configurado'
                      : `${displayQuantity(row.item.minimumStock)} ${row.item.baseUnit}`}
                  </span>
                  <span>{row.item.lotTracking ? 'Control por lote' : 'Sin control por lote'}</span>
                </Link>
              ))}
            </div>
          </>
        ) : null}
      </Card>
      <p className="inventory-footnote">
        El mínimo se compara por sede usando el mismo umbral del artículo. El indicador no genera
        compras ni notificaciones.
      </p>
    </div>
  );
}

// Metric cards present operational counts with descriptive text as well as a non-color state cue.
function MetricCard({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: number | undefined;
  detail: string;
  tone?: 'neutral' | 'warning' | 'danger';
}) {
  return (
    <Card className={`inventory-metric inventory-metric--${tone}`}>
      <p>{label}</p>
      <strong>{value === undefined ? '—' : value}</strong>
      <small>{detail}</small>
    </Card>
  );
}
