import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  InventoryItem,
  InventoryItemDetail,
  InventoryStockListResponse,
  LocationResponse,
} from '@veterinary-saas/contracts';
import { PERMISSION } from '../../auth/permissions';
import { ApiError } from '../../services/apiClient';
import { InventoryPage } from './InventoryPage';
import { InventoryItemDetailPage } from './InventoryItemDetailPage';
import { InventoryItemFormPage } from './InventoryItemFormPage';
import { InventoryOperationDialog } from './InventoryOperationDialog';

const mocks = vi.hoisted(() => ({
  organizationId: '40000000-0000-4000-8000-000000000001',
  permissions: new Set<string>(),
  resourceKeys: [] as string[],
  locationsResource: { data: null as unknown, loading: false, error: null, reload: vi.fn() },
  summaryResource: { data: null as unknown, loading: false, error: null, reload: vi.fn() },
  stockResource: { data: null as unknown, loading: false, error: null, reload: vi.fn() },
  detailResource: { data: null as unknown, loading: false, error: null, reload: vi.fn() },
  itemEditorResource: { data: null as unknown, loading: false, error: null, reload: vi.fn() },
  summary: vi.fn(),
  listItems: vi.fn(),
  findItem: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  archiveItem: vi.fn(),
  stock: vi.fn(),
  itemStock: vi.fn(),
  batches: vi.fn(),
  movements: vi.fn(),
  createMovement: vi.fn(),
  transfer: vi.fn(),
  mutationIsCurrent: true,
  refreshLocations: vi.fn(),
}));

vi.mock('../../auth/useCan', () => ({
  useCan: (permission: string) => mocks.permissions.has(permission),
}));
vi.mock('../shared/hooks', () => ({ useActiveOrganizationId: () => mocks.organizationId }));
vi.mock('../agenda/agendaApi', () => ({ agendaApi: { listLocations: vi.fn() } }));
vi.mock('./useInventoryResources', () => ({
  useInventoryResource: (key: string) => {
    mocks.resourceKeys.push(key);
    if (key === 'locations') return mocks.locationsResource;
    if (key === 'summary') return mocks.summaryResource;
    if (key.startsWith('stock:')) return mocks.stockResource;
    if (key.startsWith('item-editor:')) return mocks.itemEditorResource;
    return mocks.detailResource;
  },
  useInventoryMutationGuard: () => ({
    signal: undefined,
    organizationId: mocks.organizationId,
    isCurrent: () => mocks.mutationIsCurrent,
  }),
}));
vi.mock('./inventoryApi', () => ({
  INVENTORY_MUTATED_EVENT: 'easyvet:inventory-mutated',
  inventoryApi: {
    summary: mocks.summary,
    listItems: mocks.listItems,
    findItem: mocks.findItem,
    createItem: mocks.createItem,
    updateItem: mocks.updateItem,
    archiveItem: mocks.archiveItem,
    stock: mocks.stock,
    itemStock: mocks.itemStock,
    batches: mocks.batches,
    movements: mocks.movements,
    createMovement: mocks.createMovement,
    transfer: mocks.transfer,
  },
}));

const ids = {
  item: '40000000-0000-4000-8000-000000000010',
  locationA: '40000000-0000-4000-8000-000000000011',
  locationB: '40000000-0000-4000-8000-000000000012',
  batch: '40000000-0000-4000-8000-000000000013',
};

const locations: LocationResponse[] = [
  { id: ids.locationA, name: 'Sede Norte', status: 'ACTIVE', address: null, city: 'Bogotá' },
  { id: ids.locationB, name: 'Sede Centro', status: 'ACTIVE', address: null, city: 'Bogotá' },
];

const item: InventoryItem = {
  id: ids.item,
  organizationId: mocks.organizationId,
  name: 'Vacuna demo',
  sku: 'DEMO-001',
  itemType: 'MEDICATION',
  baseUnit: 'dosis',
  lotTracking: true,
  minimumStock: '3.000000',
  description: null,
  notes: null,
  status: 'ACTIVE',
  createdAt: '2035-01-01T00:00:00.000Z',
  updatedAt: '2035-01-01T00:00:00.000Z',
};

const itemDetail: InventoryItemDetail = {
  ...item,
  stock: {
    inventoryItemId: ids.item,
    totalStock: '2.500001',
    locations: [
      {
        clinicLocationId: ids.locationA,
        locationName: 'Sede Norte',
        locationStatus: 'ACTIVE',
        stock: '1.500001',
        lowStock: true,
      },
      {
        clinicLocationId: ids.locationB,
        locationName: 'Sede Centro',
        locationStatus: 'ACTIVE',
        stock: '1.000000',
        lowStock: true,
      },
    ],
    batches: [
      {
        id: ids.batch,
        organizationId: mocks.organizationId,
        inventoryItemId: ids.item,
        lotNumber: 'LOTE-01',
        expiryOn: '2020-01-01',
        notes: '<script>alert(1)</script>',
        createdAt: '2035-01-01T00:00:00.000Z',
        totalStock: '1.500001',
        locations: [
          {
            clinicLocationId: ids.locationA,
            locationName: 'Sede Norte',
            locationStatus: 'ACTIVE',
            stock: '1.500001',
          },
          {
            clinicLocationId: ids.locationB,
            locationName: 'Sede Centro',
            locationStatus: 'ACTIVE',
            stock: '0',
          },
        ],
        expiryStatus: 'EXPIRED',
      },
    ],
    batchPagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
  },
  recentMovements: [],
};

const stockList: InventoryStockListResponse = {
  data: [{ item, stock: '2.500001', lowStock: true, lowStockLocations: 2, clinicLocationId: null }],
  pagination: { page: 1, pageSize: 20, total: 41, totalPages: 3 },
};

// Each test starts from tenant-scoped data and explicit permission state.
beforeEach(() => {
  vi.clearAllMocks();
  mocks.organizationId = '40000000-0000-4000-8000-000000000001';
  mocks.permissions = new Set([
    PERMISSION.INVENTORY_READ,
    PERMISSION.INVENTORY_ITEMS_CREATE,
    PERMISSION.INVENTORY_ITEMS_UPDATE,
    PERMISSION.INVENTORY_ITEMS_ARCHIVE,
    PERMISSION.INVENTORY_MOVEMENTS_CREATE,
    PERMISSION.INVENTORY_ADJUSTMENTS_CREATE,
    PERMISSION.INVENTORY_TRANSFERS_CREATE,
  ]);
  mocks.resourceKeys = [];
  mocks.locationsResource = { data: locations, loading: false, error: null, reload: vi.fn() };
  mocks.summaryResource = {
    data: { activeItems: 3, lowStockItemLocations: 2, expiredBatches: 1, expiringSoonBatches: 1 },
    loading: false,
    error: null,
    reload: vi.fn(),
  };
  mocks.stockResource = { data: stockList, loading: false, error: null, reload: vi.fn() };
  mocks.detailResource = { data: itemDetail, loading: false, error: null, reload: vi.fn() };
  mocks.itemEditorResource = { data: null, loading: false, error: null, reload: vi.fn() };
  mocks.mutationIsCurrent = true;
  mocks.createMovement.mockResolvedValue(undefined);
  mocks.transfer.mockResolvedValue(undefined);
  mocks.archiveItem.mockResolvedValue({ ...item, status: 'ARCHIVED' });
});

function renderDetail() {
  return render(detailView());
}

function detailView() {
  return (
    <MemoryRouter initialEntries={[`/inventario/${ids.item}`]}>
      <Routes>
        <Route path="/inventario/:itemId" element={<InventoryItemDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderItemForm(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/inventario/nuevo" element={<InventoryItemFormPage />} />
        <Route path="/inventario/:itemId/editar" element={<InventoryItemFormPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderOperation(operation: 'ISSUE' | 'ADJUSTMENT' | 'TRANSFER') {
  const callbacks = { onClose: vi.fn(), onDone: vi.fn(), onRefresh: vi.fn() };
  const view = render(
    <MemoryRouter>
      <InventoryOperationDialog
        item={item}
        stock={itemDetail.stock}
        locations={locations}
        operation={operation}
        {...callbacks}
      />
    </MemoryRouter>,
  );
  return { ...view, callbacks };
}

describe('inventory frontend', () => {
  it('shows organization totals, clear all-location scope and low-stock labels', () => {
    render(
      <MemoryRouter initialEntries={['/inventario']}>
        <InventoryPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Inventario' })).toBeInTheDocument();
    expect(
      screen.getByText(/Todas las sedes · el stock total se suma entre sedes/),
    ).toBeInTheDocument();
    expect(screen.getByText('Artículos activos').parentElement).toHaveTextContent('3');
    expect(screen.getAllByText('Bajo mínimo').length).toBeGreaterThan(1);
    expect(screen.getByRole('link', { name: /Vacuna demo/ })).toHaveAttribute(
      'href',
      `/inventario/${ids.item}`,
    );
  });

  it('clearly switches the selected location in the stock query', () => {
    render(
      <MemoryRouter initialEntries={['/inventario']}>
        <InventoryPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Sede'), { target: { value: ids.locationA } });
    expect(mocks.resourceKeys.some((key) => key.includes(ids.locationA))).toBe(true);
  });

  it('requests the next inventory page and resets pagination when filters change', () => {
    render(
      <MemoryRouter initialEntries={['/inventario']}>
        <InventoryPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(mocks.resourceKeys.some((key) => key.includes('"page":2'))).toBe(true);

    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'SUPPLY' } });
    expect(
      mocks.resourceKeys.some((key) => key.includes('"page":1') && key.includes('SUPPLY')),
    ).toBe(true);
  });

  it('creates item metadata without creating stock or movements', async () => {
    mocks.createItem.mockResolvedValue(item);
    renderItemForm('/inventario/nuevo');

    fireEvent.change(screen.getByLabelText('Nombre del artículo'), {
      target: { value: 'Suero de QA' },
    });
    fireEvent.change(screen.getByLabelText('SKU (opcional)'), {
      target: { value: ' qa-suero-01 ' },
    });
    fireEvent.change(screen.getByLabelText('Unidad base'), { target: { value: 'ml' } });
    fireEvent.change(screen.getByLabelText('Existencia mínima por sede'), {
      target: { value: '2.500001' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear artículo' }));

    await waitFor(() =>
      expect(mocks.createItem).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Suero de QA',
          sku: 'qa-suero-01',
          itemType: 'SUPPLY',
          baseUnit: 'ml',
          lotTracking: false,
          minimumStock: '2.500001',
        }),
        undefined,
      ),
    );
    expect(mocks.createMovement).not.toHaveBeenCalled();
  });

  it('updates item metadata and locks lot tracking after the first movement', async () => {
    mocks.itemEditorResource = {
      data: { item, hasMovements: true },
      loading: false,
      error: null,
      reload: vi.fn(),
    };
    mocks.updateItem.mockResolvedValue(item);
    renderItemForm(`/inventario/${ids.item}/editar`);

    expect(await screen.findByDisplayValue('Vacuna demo')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Nombre del artículo'), {
      target: { value: 'Vacuna demo actualizada' },
    });
    fireEvent.change(screen.getByLabelText('Notas internas (opcional)'), {
      target: { value: 'Metadatos de QA' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(mocks.updateItem).toHaveBeenCalledWith(
        ids.item,
        expect.objectContaining({ name: 'Vacuna demo actualizada', notes: 'Metadatos de QA' }),
        undefined,
      ),
    );
  });

  it('renders civil expiry and untrusted notes as plain text in item detail', () => {
    renderDetail();
    expect(screen.getByText('Vencido')).toBeInTheDocument();
    expect(document.querySelector('.inventory-batch-card > span')).toHaveTextContent('01/01/2020');
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).not.toBeInTheDocument();
    expect(screen.getByText(/2\.500001/)).toBeInTheDocument();
  });

  it('creates a new lot as part of a positive-quantity receipt', async () => {
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Recibir stock' }));
    fireEvent.change(await screen.findByLabelText('Sede'), { target: { value: ids.locationA } });
    fireEvent.change(screen.getByLabelText('Lote'), { target: { value: 'new' } });
    fireEvent.change(screen.getByLabelText('Número de lote'), { target: { value: 'QA-NEW-LOT' } });
    fireEvent.change(screen.getByLabelText(/Cantidad positiva/), { target: { value: '0.125001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }));
    await waitFor(() =>
      expect(mocks.createMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          movementType: 'RECEIPT',
          quantity: '0.125001',
          newBatch: expect.objectContaining({ lotNumber: 'QA-NEW-LOT' }),
        }),
        undefined,
      ),
    );
  });

  it('submits a manual issue with a positive UI quantity and a required reason', async () => {
    const view = renderOperation('ISSUE');
    fireEvent.change(await screen.findByLabelText('Sede'), { target: { value: ids.locationA } });
    fireEvent.change(screen.getByLabelText('Lote'), { target: { value: ids.batch } });
    fireEvent.change(screen.getByLabelText(/Cantidad positiva/), { target: { value: '0.75' } });
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Uso interno QA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar salida' }));

    await waitFor(() =>
      expect(mocks.createMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          inventoryItemId: ids.item,
          clinicLocationId: ids.locationA,
          inventoryBatchId: ids.batch,
          movementType: 'ISSUE',
          quantity: '0.75',
          reason: 'Uso interno QA',
        }),
        undefined,
      ),
    );
    expect(view.callbacks.onDone).toHaveBeenCalled();
  });

  it.each([
    ['IN', 'ADJUSTMENT_IN'],
    ['OUT', 'ADJUSTMENT_OUT'],
  ] as const)(
    'submits a positive adjustment quantity for the %s direction',
    async (direction, movementType) => {
      renderOperation('ADJUSTMENT');
      fireEvent.change(await screen.findByLabelText('Sede'), {
        target: { value: ids.locationA },
      });
      fireEvent.change(screen.getByLabelText('Dirección del ajuste'), {
        target: { value: direction },
      });
      fireEvent.change(screen.getByLabelText('Lote'), { target: { value: ids.batch } });
      fireEvent.change(screen.getByLabelText(/Cantidad positiva/), { target: { value: '0.25' } });
      fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Conteo QA' } });
      fireEvent.click(screen.getByRole('button', { name: 'Registrar ajuste' }));

      await waitFor(() =>
        expect(mocks.createMovement).toHaveBeenCalledWith(
          expect.objectContaining({
            inventoryItemId: ids.item,
            inventoryBatchId: ids.batch,
            movementType,
            quantity: '0.25',
            reason: 'Conteo QA',
          }),
          undefined,
        ),
      );
      expect(screen.getByLabelText('Dirección del ajuste')).toHaveValue(direction);
    },
  );

  it('submits one transfer request for both ledger sides', async () => {
    const view = renderOperation('TRANSFER');
    fireEvent.change(await screen.findByLabelText('Sede de origen'), {
      target: { value: ids.locationA },
    });
    fireEvent.change(screen.getByLabelText('Sede de destino'), {
      target: { value: ids.locationB },
    });
    fireEvent.change(screen.getByLabelText('Lote'), { target: { value: ids.batch } });
    fireEvent.change(screen.getByLabelText(/Cantidad positiva/), { target: { value: '0.5' } });
    fireEvent.change(screen.getByLabelText('Motivo (opcional)'), {
      target: { value: 'Traslado QA' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar traslado' }));

    await waitFor(() =>
      expect(mocks.transfer).toHaveBeenCalledWith(
        expect.objectContaining({
          inventoryItemId: ids.item,
          inventoryBatchId: ids.batch,
          fromClinicLocationId: ids.locationA,
          toClinicLocationId: ids.locationB,
          quantity: '0.5',
          reason: 'Traslado QA',
        }),
        undefined,
      ),
    );
    expect(view.callbacks.onDone).toHaveBeenCalled();
    expect(mocks.createMovement).not.toHaveBeenCalled();
  });

  it('refreshes stock and does not auto-retry on insufficient stock', async () => {
    mocks.createMovement.mockRejectedValue(new ApiError('Conflict', 409, 'INSUFFICIENT_STOCK'));
    renderDetail();
    fireEvent.click(screen.getAllByRole('button', { name: 'Registrar salida' }).at(-1)!);
    fireEvent.change(await screen.findByLabelText('Sede'), { target: { value: ids.locationA } });
    fireEvent.change(screen.getByLabelText('Lote'), { target: { value: ids.batch } });
    fireEvent.change(screen.getByLabelText(/Cantidad positiva/), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Uso interno QA' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Registrar salida' }).at(-1)!);
    expect(await screen.findByText(/El stock disponible cambió/)).toBeInTheDocument();
    expect(mocks.createMovement).toHaveBeenCalledTimes(1);
    expect(mocks.detailResource.reload).toHaveBeenCalled();
  });

  it('requires confirmation and disables archive while derived stock is non-zero', () => {
    renderDetail();
    expect(screen.getByRole('button', { name: 'Archivar' })).toBeDisabled();
    expect(screen.getByText(/la existencia total debe llegar a cero/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar movimiento/ })).not.toBeInTheDocument();
  });

  it('archives a zero-stock item only after confirmation and keeps the history API path', async () => {
    mocks.detailResource = {
      data: {
        ...itemDetail,
        stock: {
          ...itemDetail.stock,
          totalStock: '0',
          locations: itemDetail.stock.locations.map((location) => ({ ...location, stock: '0' })),
          batches: [],
        },
      },
      loading: false,
      error: null,
      reload: vi.fn(),
    };
    renderDetail();

    fireEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar archivo' }));

    await waitFor(() => expect(mocks.archiveItem).toHaveBeenCalledWith(ids.item, undefined));
    expect(mocks.detailResource.reload).toHaveBeenCalled();
  });

  it('renders movement history as a read-only ledger with safe reference text', () => {
    mocks.detailResource = {
      data: {
        ...itemDetail,
        recentMovements: [
          {
            id: '40000000-0000-4000-8000-000000000014',
            organizationId: mocks.organizationId,
            inventoryItemId: ids.item,
            clinicLocationId: ids.locationA,
            inventoryBatchId: ids.batch,
            movementType: 'ISSUE',
            quantityDelta: '-0.250001',
            occurredAt: '2035-01-08T15:00:00.000Z',
            reason: '<script>unsafe reason</script>',
            reference: 'QA-REF-01',
            unitCost: null,
            transferGroupId: null,
            createdByMembershipId: '40000000-0000-4000-8000-000000000015',
            createdAt: '2035-01-08T15:00:00.000Z',
            inventoryItemName: item.name,
            clinicLocationName: 'Sede Norte',
            batchLotNumber: 'LOTE-01',
            actorDisplayName: 'Dra. Camila Rojas',
          },
        ],
      },
      loading: false,
      error: null,
      reload: vi.fn(),
    };
    renderDetail();

    expect(screen.getAllByText('<script>unsafe reason</script>')).toHaveLength(2);
    expect(screen.getByText('QA-REF-01')).toBeInTheDocument();
    expect(screen.getByText(/Referencia: QA-REF-01/)).toBeInTheDocument();
    expect(document.querySelector('script')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /editar movimiento|eliminar movimiento/i }),
    ).toBeNull();
  });

  it('keeps stock-only roles read-only without hiding the list', () => {
    mocks.permissions = new Set([PERMISSION.INVENTORY_READ]);
    render(
      <MemoryRouter initialEntries={['/inventario']}>
        <InventoryPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Artículos' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Nuevo artículo' })).not.toBeInTheDocument();
  });

  it('keeps inventory detail read-only for stock-only roles', () => {
    mocks.permissions = new Set([PERMISSION.INVENTORY_READ]);
    renderDetail();

    expect(screen.getByRole('heading', { name: 'Vacuna demo' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Editar artículo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Recibir stock' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Registrar salida' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ajustar inventario' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Trasladar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Archivar' })).toBeNull();
  });
});
