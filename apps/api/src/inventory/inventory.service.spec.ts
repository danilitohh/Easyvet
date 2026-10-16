import { describe, expect, it, jest } from '@jest/globals';
import {
  InventoryItemStatus,
  InventoryItemType,
  ClinicLocationStatus,
  Prisma,
} from '@prisma/client';
import type { PrismaService } from '../infrastructure/database/prisma.service';
import { InventoryService } from './inventory.service';

describe('InventoryService stock pagination', () => {
  it('aggregates item totals independently and limits batch-location work to the requested page', async () => {
    const organizationId = '40000000-0000-4000-8000-000000000031';
    const itemId = '40000000-0000-4000-8000-000000000032';
    const locationId = '40000000-0000-4000-8000-000000000033';
    const batchId = '40000000-0000-4000-8000-000000000034';
    const batch = {
      id: batchId,
      organizationId,
      inventoryItemId: itemId,
      lotNumber: 'LOT-2',
      expiryOn: new Date('2035-02-01T00:00:00.000Z'),
      notes: null,
      createdAt: new Date('2035-01-02T00:00:00.000Z'),
    };
    const item = {
      id: itemId,
      organizationId,
      name: 'Vacuna',
      sku: null,
      itemType: InventoryItemType.MEDICATION,
      baseUnit: 'dosis',
      lotTracking: true,
      minimumStock: new Prisma.Decimal('2'),
      description: null,
      notes: null,
      status: InventoryItemStatus.ACTIVE,
      createdAt: new Date('2035-01-01T00:00:00.000Z'),
      updatedAt: new Date('2035-01-01T00:00:00.000Z'),
    };
    const groupBy = jest
      .fn<(...args: unknown[]) => Promise<unknown[]>>()
      .mockImplementation((...args) => {
        const input = args[0] as { by: string[] };
        return input.by.includes('inventoryBatchId')
          ? Promise.resolve([
              {
                clinicLocationId: locationId,
                inventoryBatchId: batchId,
                _sum: { quantityDelta: new Prisma.Decimal('3') },
              },
            ])
          : Promise.resolve([
              {
                clinicLocationId: locationId,
                _sum: { quantityDelta: new Prisma.Decimal('3') },
              },
            ]);
      });
    const prisma = {
      inventoryItem: {
        findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(item),
      },
      clinicLocation: {
        findMany: jest
          .fn<(...args: unknown[]) => Promise<unknown[]>>()
          .mockResolvedValue([
            { id: locationId, name: 'Sede', status: ClinicLocationStatus.ACTIVE },
          ]),
      },
      inventoryBatch: {
        findMany: jest.fn<(...args: unknown[]) => Promise<unknown[]>>().mockResolvedValue([batch]),
        count: jest.fn<(args: unknown) => Promise<number>>().mockResolvedValue(12),
      },
      inventoryMovement: {
        aggregate: jest
          .fn<(...args: unknown[]) => Promise<unknown>>()
          .mockResolvedValue({ _sum: { quantityDelta: new Prisma.Decimal('3') } }),
        groupBy,
      },
      organization: {
        findUnique: jest
          .fn<(...args: unknown[]) => Promise<unknown>>()
          .mockResolvedValue({ timezone: 'UTC' }),
      },
    } as unknown as PrismaService;

    const result = await new InventoryService(prisma).itemStock(organizationId, itemId, {
      page: 2,
      pageSize: 1,
    });

    expect(prisma.inventoryBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 1, take: 1 }),
    );
    expect(groupBy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ inventoryBatchId: { in: [batchId] } }),
      }),
    );
    expect(result).toMatchObject({
      totalStock: '3',
      batchPagination: { page: 2, pageSize: 1, total: 12, totalPages: 12 },
      batches: [{ id: batchId, totalStock: '3' }],
    });
  });

  it('loads only the requested batch page and preserves the item total', async () => {
    const organizationId = '40000000-0000-4000-8000-000000000021';
    const itemId = '40000000-0000-4000-8000-000000000022';
    const batchFindMany = jest.fn<(...args: unknown[]) => Promise<unknown[]>>().mockResolvedValue([
      {
        id: '40000000-0000-4000-8000-000000000023',
        organizationId,
        inventoryItemId: itemId,
        lotNumber: 'LOT-2',
        expiryOn: new Date('2035-02-01T00:00:00.000Z'),
        notes: null,
        createdAt: new Date('2035-01-02T00:00:00.000Z'),
      },
    ]);
    const batchCount = jest.fn<(args: unknown) => Promise<number>>().mockResolvedValue(45);
    const prisma = {
      inventoryBatch: { findMany: batchFindMany, count: batchCount },
      inventoryItem: {
        findFirst: jest
          .fn<(...args: unknown[]) => Promise<unknown>>()
          .mockResolvedValue({ id: itemId, organizationId }),
      },
      $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    } as unknown as PrismaService;

    const result = await new InventoryService(prisma).listBatches(organizationId, itemId, {
      page: 2,
      pageSize: 20,
    });

    expect(batchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20,
        orderBy: [{ expiryOn: 'asc' }, { lotNumber: 'asc' }, { id: 'asc' }],
      }),
    );
    expect(batchCount).toHaveBeenCalledWith({ where: { organizationId, inventoryItemId: itemId } });
    expect(result).toMatchObject({
      data: [{ id: '40000000-0000-4000-8000-000000000023' }],
      pagination: { page: 2, pageSize: 20, total: 45, totalPages: 3 },
    });
  });

  it('loads only the requested item page and preserves the catalog total', async () => {
    const organizationId = '40000000-0000-4000-8000-000000000001';
    const itemId = '40000000-0000-4000-8000-000000000002';
    const locationId = '40000000-0000-4000-8000-000000000003';
    const itemFindMany = jest.fn<(...args: unknown[]) => Promise<unknown[]>>().mockResolvedValue([
      {
        id: itemId,
        organizationId,
        name: 'Suero de prueba',
        sku: null,
        itemType: InventoryItemType.SUPPLY,
        baseUnit: 'unidad',
        lotTracking: false,
        minimumStock: new Prisma.Decimal('2'),
        description: null,
        notes: null,
        status: InventoryItemStatus.ACTIVE,
        createdAt: new Date('2035-01-01T00:00:00.000Z'),
        updatedAt: new Date('2035-01-01T00:00:00.000Z'),
      },
    ]);
    const itemCount = jest.fn<(args: unknown) => Promise<number>>().mockResolvedValue(45);
    const prisma = {
      inventoryItem: { findMany: itemFindMany, count: itemCount },
      clinicLocation: {
        findMany: jest
          .fn<(...args: unknown[]) => Promise<unknown[]>>()
          .mockResolvedValue([
            { id: locationId, name: 'Sede de prueba', status: ClinicLocationStatus.ACTIVE },
          ]),
      },
      $queryRaw: jest
        .fn<(...args: unknown[]) => Promise<unknown[]>>()
        .mockResolvedValue([
          { inventoryItemId: itemId, clinicLocationId: locationId, stock: new Prisma.Decimal('4') },
        ]),
    } as unknown as PrismaService;

    const result = await new InventoryService(prisma).listStock(organizationId, {
      page: 2,
      pageSize: 20,
      status: 'ACTIVE',
      includeArchived: false,
    });

    expect(itemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
    );
    expect(itemCount).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      data: [{ item: { id: itemId }, stock: '4', lowStock: false }],
      pagination: { page: 2, pageSize: 20, total: 45, totalPages: 3 },
    });
  });

  it('uses the SQL-filtered page and its full matching count for low-stock results', async () => {
    const organizationId = '40000000-0000-4000-8000-000000000011';
    const itemId = '40000000-0000-4000-8000-000000000012';
    const itemFindMany = jest.fn<(...args: unknown[]) => Promise<unknown[]>>().mockResolvedValue([
      {
        id: itemId,
        organizationId,
        name: 'Artículo bajo mínimo',
        sku: null,
        itemType: InventoryItemType.SUPPLY,
        baseUnit: 'unidad',
        lotTracking: false,
        minimumStock: new Prisma.Decimal('1'),
        description: null,
        notes: null,
        status: InventoryItemStatus.ACTIVE,
        createdAt: new Date('2035-01-01T00:00:00.000Z'),
        updatedAt: new Date('2035-01-01T00:00:00.000Z'),
      },
    ]);
    const queryRaw = jest.fn<(...args: unknown[]) => Promise<unknown[]>>().mockResolvedValue([
      {
        inventoryItemId: itemId,
        stock: new Prisma.Decimal('0'),
        lowStockLocations: 2,
        total: 21n,
      },
    ]);
    const prisma = {
      inventoryItem: { findMany: itemFindMany },
      $queryRaw: queryRaw,
    } as unknown as PrismaService;

    const result = await new InventoryService(prisma).listStock(organizationId, {
      page: 2,
      pageSize: 20,
      status: 'ACTIVE',
      lowStock: true,
    });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(itemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId, id: { in: [itemId] } } }),
    );
    expect(result).toMatchObject({
      data: [{ item: { id: itemId }, stock: '0', lowStock: true, lowStockLocations: 2 }],
      pagination: { page: 2, pageSize: 20, total: 21, totalPages: 2 },
    });
  });
});
