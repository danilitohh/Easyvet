import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiClient: vi.fn() }));

vi.mock('../../services/apiClient', () => ({ apiClient: mocks.apiClient }));

import { inventoryApi } from './inventoryApi';

describe('inventory API boundary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('preserves an explicit false low-stock filter and string decimal results', async () => {
    mocks.apiClient.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
    const result = await inventoryApi.stock({
      page: 1,
      pageSize: 20,
      lowStock: false,
      includeArchived: false,
    });

    expect(mocks.apiClient).toHaveBeenCalledWith(
      '/inventory/stock?page=1&pageSize=20&lowStock=false&includeArchived=false',
      {},
    );
    expect(result.data).toEqual([]);
  });

  it('keeps positive movement quantities exact strings and validates lot receipt dates', async () => {
    mocks.apiClient.mockResolvedValue(undefined);
    await inventoryApi.createMovement({
      inventoryItemId: '50000000-0000-4000-8000-000000000001',
      clinicLocationId: '50000000-0000-4000-8000-000000000002',
      movementType: 'RECEIPT',
      quantity: '0.123456',
      occurredAt: '2035-01-08T15:00:00.000Z',
      newBatch: { lotNumber: 'LOTE-1', expiryOn: '2035-01-08' },
    });
    expect(mocks.apiClient).toHaveBeenCalledWith(
      '/inventory/movements',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          quantity: '0.123456',
          newBatch: expect.objectContaining({ expiryOn: '2035-01-08' }),
        }),
      }),
    );
  });

  it('rejects movement requests that omit issue reasons or use invalid civil expiry dates', async () => {
    await expect(
      inventoryApi.createMovement({
        inventoryItemId: '50000000-0000-4000-8000-000000000001',
        clinicLocationId: '50000000-0000-4000-8000-000000000002',
        movementType: 'ISSUE',
        quantity: '1',
        occurredAt: '2035-01-08T15:00:00.000Z',
      }),
    ).rejects.toThrow();
    await expect(
      inventoryApi.createMovement({
        inventoryItemId: '50000000-0000-4000-8000-000000000001',
        clinicLocationId: '50000000-0000-4000-8000-000000000002',
        movementType: 'RECEIPT',
        quantity: '1',
        occurredAt: '2035-01-08T15:00:00.000Z',
        newBatch: { lotNumber: 'LOTE-2', expiryOn: '2035-02-31' },
      }),
    ).rejects.toThrow();
    expect(mocks.apiClient).not.toHaveBeenCalled();
  });

  it('sends transfer quantities as positive strings and never accepts same-location transfers', async () => {
    const transferGroupId = '50000000-0000-4000-8000-000000000004';
    const organizationId = '50000000-0000-4000-8000-000000000005';
    const itemId = '50000000-0000-4000-8000-000000000001';
    const actorId = '50000000-0000-4000-8000-000000000006';
    const commonMovement = {
      organizationId,
      inventoryItemId: itemId,
      inventoryBatchId: null,
      occurredAt: '2035-01-08T15:00:00.000Z',
      reason: 'Traslado de prueba',
      reference: null,
      unitCost: null,
      transferGroupId,
      createdByMembershipId: actorId,
      createdAt: '2035-01-08T15:00:00.000Z',
      inventoryItemName: 'Item',
      batchLotNumber: null,
      actorDisplayName: 'Owner',
    };
    mocks.apiClient.mockResolvedValue({
      transferGroupId,
      movements: [
        {
          ...commonMovement,
          id: '50000000-0000-4000-8000-000000000007',
          clinicLocationId: '50000000-0000-4000-8000-000000000002',
          clinicLocationName: 'Norte',
          movementType: 'TRANSFER_OUT',
          quantityDelta: '-1.000001',
        },
        {
          ...commonMovement,
          id: '50000000-0000-4000-8000-000000000008',
          clinicLocationId: '50000000-0000-4000-8000-000000000003',
          clinicLocationName: 'Centro',
          movementType: 'TRANSFER_IN',
          quantityDelta: '1.000001',
        },
      ],
    });
    const result = await inventoryApi.transfer({
      inventoryItemId: '50000000-0000-4000-8000-000000000001',
      fromClinicLocationId: '50000000-0000-4000-8000-000000000002',
      toClinicLocationId: '50000000-0000-4000-8000-000000000003',
      quantity: '1.000001',
      occurredAt: '2035-01-08T15:00:00.000Z',
    });
    expect(result.movements).toHaveLength(2);
    expect(mocks.apiClient).toHaveBeenCalledWith(
      '/inventory/transfers',
      expect.objectContaining({
        body: expect.objectContaining({ quantity: '1.000001' }),
      }),
    );
    await expect(
      inventoryApi.transfer({
        inventoryItemId: itemId,
        fromClinicLocationId: '50000000-0000-4000-8000-000000000002',
        toClinicLocationId: '50000000-0000-4000-8000-000000000002',
        quantity: '1',
        occurredAt: '2035-01-08T15:00:00.000Z',
      }),
    ).rejects.toThrow();
    expect(mocks.apiClient).toHaveBeenCalledTimes(1);
  });
});
