import { describe, expect, it, jest } from '@jest/globals';
import { InventoryItemStatus, InventoryItemType, ClinicLocationStatus, Prisma } from '@prisma/client';
import type { PrismaService } from '../infrastructure/database/prisma.service';
import { InventoryService } from './inventory.service';

describe('InventoryService stock pagination', () => {
  it('loads only the requested item page and preserves the catalog total', async () => {
    const organizationId = '40000000-0000-4000-8000-000000000001';
    const itemId = '40000000-0000-4000-8000-000000000002';
    const locationId = '40000000-0000-4000-8000-000000000003';
    const itemFindMany = jest.fn().mockResolvedValue([
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
    const itemCount = jest.fn().mockResolvedValue(45);
    const prisma = {
      inventoryItem: { findMany: itemFindMany, count: itemCount },
      clinicLocation: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: locationId, name: 'Sede de prueba', status: ClinicLocationStatus.ACTIVE },
          ]),
      },
      $queryRaw: jest
        .fn()
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
    const itemFindMany = jest.fn().mockResolvedValue([
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
    const queryRaw = jest.fn().mockResolvedValue([
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
