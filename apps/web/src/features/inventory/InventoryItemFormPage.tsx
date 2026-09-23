import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { InventoryItemType } from '@veterinary-saas/contracts';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { ResourceError } from '../shared/ResourceFeedback';
import { useActiveOrganizationId } from '../shared/hooks';
import { useInventoryMutationGuard, useInventoryResource } from './useInventoryResources';
import { INVENTORY_MUTATED_EVENT, inventoryApi } from './inventoryApi';
import { INVENTORY_ITEM_TYPE_LABEL } from './inventoryUtils';
import './inventory.css';

const ITEM_TYPES: InventoryItemType[] = ['MEDICATION', 'SUPPLY', 'RETAIL', 'OTHER'];

// Keying the editor by tenant and item ensures a switch cannot preserve another organization's draft.
export function InventoryItemFormPage() {
  const { itemId } = useParams();
  const organizationId = useActiveOrganizationId();
  return (
    <InventoryItemForm key={`${organizationId ?? 'none'}:${itemId ?? 'new'}`} itemId={itemId} />
  );
}

function InventoryItemForm({ itemId }: { itemId: string | undefined }) {
  const isEdit = Boolean(itemId);
  const canCreate = useCan(PERMISSION.INVENTORY_ITEMS_CREATE);
  const canUpdate = useCan(PERMISSION.INVENTORY_ITEMS_UPDATE);
  const canSave = isEdit ? canUpdate : canCreate;
  const navigate = useNavigate();
  const guard = useInventoryMutationGuard();
  const itemResource = useInventoryResource(
    `item-editor:${itemId ?? ''}`,
    isEdit && Boolean(itemId),
    async (signal) => {
      const [item, movementHistory] = await Promise.all([
        inventoryApi.findItem(itemId!, signal),
        inventoryApi.movements({ inventoryItemId: itemId!, page: 1, pageSize: 1 }, signal),
      ]);
      return { item, hasMovements: movementHistory.pagination.total > 0 };
    },
  );
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [itemType, setItemType] = useState<InventoryItemType>('SUPPLY');
  const [baseUnit, setBaseUnit] = useState('unidad');
  const [lotTracking, setLotTracking] = useState(false);
  const [minimumStock, setMinimumStock] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [loadedItemId, setLoadedItemId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    const data = itemResource.data;
    if (!data || data.item.id === loadedItemId) return;
    setName(data.item.name);
    setSku(data.item.sku ?? '');
    setItemType(data.item.itemType);
    setBaseUnit(data.item.baseUnit);
    setLotTracking(data.item.lotTracking);
    setMinimumStock(data.item.minimumStock ?? '');
    setDescription(data.item.description ?? '');
    setNotes(data.item.notes ?? '');
    setLoadedItemId(data.item.id);
  }, [itemResource.data, loadedItemId]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    setValidationError('');
    const payload = {
      name,
      sku: sku.trim() || null,
      itemType,
      baseUnit,
      lotTracking,
      minimumStock: minimumStock.trim() || null,
      description: description.trim() || null,
      notes: notes.trim() || null,
    };
    try {
      const item = isEdit
        ? await inventoryApi.updateItem(itemId!, payload, guard.signal)
        : await inventoryApi.createItem(payload, guard.signal);
      if (!guard.isCurrent()) return;
      window.dispatchEvent(new Event(INVENTORY_MUTATED_EVENT));
      navigate(`/inventario/${item.id}`, { replace: !isEdit });
    } catch (requestError) {
      if (guard.isCurrent()) {
        if (requestError instanceof Error && requestError.name === 'ZodError') {
          setValidationError(
            'Revisa el nombre, la unidad base y que el mínimo sea una cantidad decimal válida.',
          );
        } else {
          setError(requestError);
        }
      }
    } finally {
      if (guard.isCurrent()) setSaving(false);
    }
  };

  if (isEdit && itemResource.loading) return <LoadingState label="Cargando artículo" />;
  if (isEdit && itemResource.error) {
    return (
      <div className="page-stack inventory-page">
        <ResourceError
          error={itemResource.error}
          fallback="No fue posible cargar el artículo."
          onRetry={itemResource.reload}
        />
      </div>
    );
  }

  return (
    <div className="page-stack inventory-page inventory-form-page">
      <PageHeader
        eyebrow={`Inventario · ${isEdit ? 'Artículo' : 'Catálogo'}`}
        title={isEdit ? 'Editar artículo' : 'Nuevo artículo'}
        description="Define los datos del catálogo. El stock se incorpora luego mediante entradas y nunca se edita desde este formulario."
      />
      {!canSave ? (
        <Alert tone="warning" role="status">
          Tu perfil puede consultar el catálogo, pero no modificarlo.
        </Alert>
      ) : null}
      {error ? (
        <ResourceError error={error} fallback="No fue posible guardar el artículo." />
      ) : null}
      {validationError ? (
        <Alert tone="error" role="alert">
          {validationError}
        </Alert>
      ) : null}
      <Card className="inventory-form-card">
        <form className="inventory-form" onSubmit={onSubmit}>
          <div className="inventory-form-grid">
            <FormField label="Nombre del artículo" htmlFor="inventory-name">
              <input
                id="inventory-name"
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={200}
                required
              />
            </FormField>
            <FormField
              label="SKU (opcional)"
              htmlFor="inventory-sku"
              hint="Se normaliza en mayúsculas y es único dentro de esta organización."
            >
              <input
                id="inventory-sku"
                className="input"
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                maxLength={100}
              />
            </FormField>
            <FormField label="Tipo" htmlFor="inventory-type">
              <select
                id="inventory-type"
                className="input"
                value={itemType}
                onChange={(event) => setItemType(event.target.value as InventoryItemType)}
              >
                {ITEM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {INVENTORY_ITEM_TYPE_LABEL[type]}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label="Unidad base"
              htmlFor="inventory-unit"
              hint="No se convierten unidades en esta versión."
            >
              <input
                id="inventory-unit"
                className="input"
                value={baseUnit}
                onChange={(event) => setBaseUnit(event.target.value)}
                maxLength={40}
                required
              />
            </FormField>
            <FormField
              label="Existencia mínima por sede"
              htmlFor="inventory-minimum"
              hint="El mismo umbral se aplica en cada sede activa."
            >
              <input
                id="inventory-minimum"
                className="input"
                type="number"
                min="0"
                step="0.000001"
                inputMode="decimal"
                value={minimumStock}
                onChange={(event) => setMinimumStock(event.target.value)}
              />
            </FormField>
            <label className="inventory-checkbox-field" htmlFor="inventory-lot-tracking">
              <input
                id="inventory-lot-tracking"
                type="checkbox"
                checked={lotTracking}
                disabled={isEdit && Boolean(itemResource.data?.hasMovements)}
                onChange={(event) => setLotTracking(event.target.checked)}
              />
              <span>
                <strong>Controlar existencias por lote</strong>
                <small>
                  {itemResource.data?.hasMovements
                    ? 'No se puede cambiar después del primer movimiento.'
                    : 'Todo movimiento del artículo requerirá un lote.'}
                </small>
              </span>
            </label>
            <FormField label="Descripción (opcional)" htmlFor="inventory-description">
              <textarea
                id="inventory-description"
                className="input inventory-textarea"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={2000}
                rows={3}
              />
            </FormField>
            <FormField label="Notas internas (opcional)" htmlFor="inventory-notes">
              <textarea
                id="inventory-notes"
                className="input inventory-textarea"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={5000}
                rows={3}
              />
            </FormField>
          </div>
          <div className="inventory-form-actions">
            <Button
              as={Link}
              to={isEdit ? `/inventario/${itemId}` : '/inventario'}
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSave || saving}>
              {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear artículo'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
