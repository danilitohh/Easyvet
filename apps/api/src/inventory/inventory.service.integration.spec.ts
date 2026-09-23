import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { TenantContext } from '../authorization/authorization.types';
import type {
  CreateInventoryItemRequest,
  CreateInventoryMovementRequest,
} from '@veterinary-saas/contracts';
import { InventoryService } from './inventory.service';

const describeDatabase = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

// PostgreSQL tests target only easyvet_test and exercise row locks, tenant FKs and ledger triggers.
describeDatabase('inventory service', () => {
  let prisma: PrismaClient;
  let inventory: InventoryService;
  let organizationId: string;
  let foreignOrganizationId: string;
  let locationA: string;
  let locationB: string;
  let owner: TenantContext;
  const suffix = Date.now().toString(36);
  const organizations: string[] = [];
  const users: string[] = [];
  const memberships: string[] = [];
  const locations: string[] = [];

  // Movement payloads use only positive quantity; the service owns signed ledger deltas.
  function movement(
    itemId: string,
    locationId: string,
    movementType: CreateInventoryMovementRequest['movementType'],
    quantity: string,
    overrides: Partial<CreateInventoryMovementRequest> = {},
  ): CreateInventoryMovementRequest {
    return {
      inventoryItemId: itemId,
      clinicLocationId: locationId,
      movementType,
      quantity,
      occurredAt: '2035-01-08T15:00:00.000Z',
      ...(movementType === 'RECEIPT' ? {} : { reason: 'Prueba automatizada ficticia' }),
      ...overrides,
    };
  }

  // Test items belong to unique test tenants so retries never collide with seeded catalog data.
  async function createItem(overrides: Partial<CreateInventoryItemRequest> = {}) {
    const item = await inventory.createItem(organizationId, {
      name: `Artículo QA ${suffix}`,
      itemType: 'SUPPLY',
      baseUnit: 'unidad',
      lotTracking: false,
      ...overrides,
    });
    return item;
  }

  // Every successful receipt is tracked so append-only rows can be removed only during test cleanup.
  async function recordMovement(
    input: CreateInventoryMovementRequest,
    actor: TenantContext = owner,
  ) {
    const saved = await inventory.createMovement(actor, input);
    return saved;
  }

  beforeAll(async () => {
    const url = process.env.DATABASE_URL_TEST;
    if (!url) throw new Error('DATABASE_URL_TEST is required when RUN_DB_TESTS=1');
    if (new URL(url).pathname.replace(/^\//, '') !== 'easyvet_test') {
      throw new Error('Inventory database tests must use easyvet_test');
    }
    prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.$connect();
    inventory = new InventoryService(prisma as never);

    const [organization, foreignOrganization] = await Promise.all([
      prisma.organization.create({
        data: {
          name: `Inventory QA ${suffix}`,
          slug: `inventory-qa-${suffix}`,
          timezone: 'America/Bogota',
        },
      }),
      prisma.organization.create({
        data: { name: `Inventory Foreign QA ${suffix}`, slug: `inventory-foreign-qa-${suffix}` },
      }),
    ]);
    organizationId = organization.id;
    foreignOrganizationId = foreignOrganization.id;
    organizations.push(organizationId, foreignOrganizationId);

    const user = await prisma.user.create({
      data: { email: `inventory-owner-${suffix}@example.local`, passwordHash: 'integration-only' },
    });
    users.push(user.id);
    const membership = await prisma.membership.create({
      data: { userId: user.id, organizationId, role: 'OWNER', status: 'ACTIVE' },
    });
    memberships.push(membership.id);
    owner = {
      organizationId,
      membershipId: membership.id,
      role: 'OWNER',
      clinicalRole: null,
      userId: user.id,
    };

    const [north, south] = await Promise.all([
      prisma.clinicLocation.create({
        data: { organizationId, name: 'Sede Norte QA', status: 'ACTIVE' },
      }),
      prisma.clinicLocation.create({
        data: { organizationId, name: 'Sede Centro QA', status: 'ACTIVE' },
      }),
    ]);
    locationA = north.id;
    locationB = south.id;
    locations.push(locationA, locationB);
  });

  afterAll(async () => {
    if (!prisma) return;
    try {
      if (organizations.length) {
        await prisma.$executeRaw`ALTER TABLE inventory_movements DISABLE TRIGGER USER`;
        await prisma.inventoryMovement.deleteMany({
          where: { organizationId: { in: organizations } },
        });
        await prisma.$executeRaw`ALTER TABLE inventory_movements ENABLE TRIGGER USER`;
        await prisma.inventoryBatch.deleteMany({
          where: { organizationId: { in: organizations } },
        });
        await prisma.inventoryItem.deleteMany({ where: { organizationId: { in: organizations } } });
      }
      if (locations.length)
        await prisma.clinicLocation.deleteMany({ where: { id: { in: locations } } });
      if (memberships.length)
        await prisma.membership.deleteMany({ where: { id: { in: memberships } } });
      if (users.length) await prisma.user.deleteMany({ where: { id: { in: users } } });
      if (organizations.length)
        await prisma.organization.deleteMany({ where: { id: { in: organizations } } });
    } finally {
      await prisma.$executeRaw`ALTER TABLE inventory_movements ENABLE TRIGGER USER`.catch(
        () => undefined,
      );
      await prisma.$disconnect();
    }
  });

  it('normalizes SKUs per tenant and keeps cross-tenant item lookups uninformative', async () => {
    const item = await createItem({ sku: ` sku-${suffix} ` });
    await expect(createItem({ sku: `SKU-${suffix}` })).rejects.toMatchObject({ status: 409 });
    await expect(inventory.findItem(foreignOrganizationId, item.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('derives precise fractional stock from the append-only ledger', async () => {
    const item = await createItem({ minimumStock: '2' });
    await recordMovement(movement(item.id, locationA, 'RECEIPT', '3.123456'));
    await recordMovement(movement(item.id, locationA, 'ISSUE', '1.000001'));
    await recordMovement(movement(item.id, locationA, 'ADJUSTMENT_OUT', '0.123455'));
    await recordMovement(movement(item.id, locationA, 'ADJUSTMENT_IN', '0.000001'));

    const detail = await inventory.itemStock(organizationId, item.id);
    const dbAggregate = await prisma.inventoryMovement.aggregate({
      where: { organizationId, inventoryItemId: item.id },
      _sum: { quantityDelta: true },
    });
    expect(detail.totalStock).toBe('2.000001');
    expect(detail.totalStock).toBe(dbAggregate._sum.quantityDelta?.toString());
    expect(
      detail.locations.find((location) => location.clinicLocationId === locationA)?.lowStock,
    ).toBe(false);
  });

  it('creates lots atomically with receipt and classifies civil expiry in the organization timezone', async () => {
    const item = await createItem({ lotTracking: true });
    const todayParts = new Intl.DateTimeFormat('en', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const dateParts = Object.fromEntries(todayParts.map((part) => [part.type, part.value]));
    const today = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
    const expired = await recordMovement(
      movement(item.id, locationA, 'RECEIPT', '2', {
        newBatch: { lotNumber: `VENCIDO-${suffix}`, expiryOn: '2000-01-01' },
      }),
    );
    const expiring = await recordMovement(
      movement(item.id, locationA, 'RECEIPT', '3', {
        newBatch: { lotNumber: `HOY-${suffix}`, expiryOn: today },
      }),
    );
    const [expiredBatch, expiringBatch] = await Promise.all([
      prisma.inventoryBatch.findFirstOrThrow({
        where: { organizationId, inventoryItemId: item.id, lotNumber: `VENCIDO-${suffix}` },
      }),
      prisma.inventoryBatch.findFirstOrThrow({
        where: { organizationId, inventoryItemId: item.id, lotNumber: `HOY-${suffix}` },
      }),
    ]);
    expect(expired.inventoryBatchId).toBe(expiredBatch.id);
    expect(expiring.inventoryBatchId).toBe(expiringBatch.id);
    expect(expiringBatch.expiryOn?.toISOString().slice(0, 10)).toBe(today);
    const detail = await inventory.itemStock(organizationId, item.id);
    expect(detail.batches.find((batch) => batch.id === expiredBatch.id)?.expiryStatus).toBe(
      'EXPIRED',
    );
    expect(detail.batches.find((batch) => batch.id === expiringBatch.id)?.expiryStatus).toBe(
      'EXPIRING_SOON',
    );
  });

  it('requires batch metadata only for lot-tracked items and locks tracking mode after ledger history', async () => {
    const item = await createItem({ lotTracking: false });
    const lotEnabled = await inventory.updateItem(organizationId, item.id, { lotTracking: true });
    expect(lotEnabled.lotTracking).toBe(true);
    await expect(
      recordMovement(movement(item.id, locationA, 'RECEIPT', '1')),
    ).rejects.toMatchObject({
      response: { code: 'INVENTORY_BATCH_REQUIRED' },
    });
    await recordMovement(
      movement(item.id, locationA, 'RECEIPT', '1', {
        newBatch: { lotNumber: `TRACKED-${suffix}` },
      }),
    );
    await expect(
      inventory.updateItem(organizationId, item.id, { lotTracking: false }),
    ).rejects.toMatchObject({
      response: { code: 'INVENTORY_LOT_TRACKING_IMMUTABLE' },
    });
  });

  it('commits transfer pairs atomically and derives the same organization total', async () => {
    const item = await createItem();
    await recordMovement(movement(item.id, locationA, 'RECEIPT', '5'));
    const transfer = await inventory.createTransfer(owner, {
      inventoryItemId: item.id,
      fromClinicLocationId: locationA,
      toClinicLocationId: locationB,
      quantity: '3.25',
      occurredAt: '2035-01-08T15:00:00.000Z',
    });
    expect(transfer.movements.map((entry) => entry.movementType)).toEqual([
      'TRANSFER_OUT',
      'TRANSFER_IN',
    ]);
    expect(new Set(transfer.movements.map((entry) => entry.transferGroupId))).toEqual(
      new Set([transfer.transferGroupId]),
    );
    const detail = await inventory.itemStock(organizationId, item.id);
    expect(detail.totalStock).toBe('5');
    expect(
      detail.locations.find((location) => location.clinicLocationId === locationA)?.stock,
    ).toBe('1.75');
    expect(
      detail.locations.find((location) => location.clinicLocationId === locationB)?.stock,
    ).toBe('3.25');
    await expect(
      inventory.createTransfer(owner, {
        inventoryItemId: item.id,
        fromClinicLocationId: locationA,
        toClinicLocationId: locationB,
        quantity: '2',
        occurredAt: '2035-01-08T15:00:00.000Z',
      }),
    ).rejects.toMatchObject({ response: { code: 'INSUFFICIENT_STOCK' } });
  });

  it('serializes simultaneous issues so exactly one may consume the remaining stock', async () => {
    const item = await createItem();
    await recordMovement(movement(item.id, locationA, 'RECEIPT', '5'));
    const results = await Promise.allSettled([
      inventory.createMovement(owner, movement(item.id, locationA, 'ISSUE', '4')),
      inventory.createMovement(owner, movement(item.id, locationA, 'ISSUE', '4')),
    ]);
    const successful = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(successful).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      response: { code: 'INSUFFICIENT_STOCK' },
    });
    const stock = await inventory.itemStock(organizationId, item.id);
    expect(stock.totalStock).toBe('1');
    expect(stock.totalStock.startsWith('-')).toBe(false);
  });

  it('serializes a transfer against an issue on the same item and prevents stock oversell', async () => {
    const item = await createItem();
    await recordMovement(movement(item.id, locationA, 'RECEIPT', '10'));
    const results = await Promise.allSettled([
      inventory.createTransfer(owner, {
        inventoryItemId: item.id,
        fromClinicLocationId: locationA,
        toClinicLocationId: locationB,
        quantity: '7',
        occurredAt: '2035-01-08T15:00:00.000Z',
      }),
      inventory.createMovement(owner, movement(item.id, locationA, 'ISSUE', '5')),
    ]);
    const successful = results.filter((result) => result.status === 'fulfilled');
    expect(successful).toHaveLength(1);
    const transferSucceeded = results[0].status === 'fulfilled';
    const rejected = results[transferSucceeded ? 1 : 0] as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ response: { code: 'INSUFFICIENT_STOCK' } });
    const stock = await inventory.itemStock(organizationId, item.id);
    const stockByLocation = new Map(
      stock.locations.map((location) => [location.clinicLocationId, location.stock]),
    );

    // The operation that acquires the item lock first determines the valid remaining stock.
    expect(stock.totalStock).toBe(transferSucceeded ? '10' : '5');
    expect(stockByLocation.get(locationA)).toBe(transferSucceeded ? '3' : '5');
    expect(stockByLocation.get(locationB)).toBe(transferSucceeded ? '7' : '0');
    expect(stock.locations.every((location) => !location.stock.startsWith('-'))).toBe(true);
  });

  it('archives only zero-stock items, preserves history, and blocks future movements', async () => {
    const item = await createItem();
    const receipt = await recordMovement(movement(item.id, locationA, 'RECEIPT', '1'));
    await expect(inventory.archiveItem(organizationId, item.id)).rejects.toMatchObject({
      response: { code: 'INVENTORY_ITEM_HAS_STOCK' },
    });
    await recordMovement(movement(item.id, locationA, 'ISSUE', '1'));
    const archived = await inventory.archiveItem(organizationId, item.id);
    expect(archived.status).toBe('ARCHIVED');
    expect(
      (
        await inventory.listMovements(organizationId, {
          page: 1,
          pageSize: 20,
          inventoryItemId: item.id,
        })
      ).data.map(({ id }) => id),
    ).toContain(receipt.id);
    await expect(
      recordMovement(movement(item.id, locationA, 'RECEIPT', '1')),
    ).rejects.toMatchObject({
      response: { code: 'INVENTORY_ITEM_ARCHIVED' },
    });
  });

  it('rejects movements to inactive locations and database-level movement edits/deletes', async () => {
    const item = await createItem();
    const receipt = await recordMovement(movement(item.id, locationA, 'RECEIPT', '2'));
    await prisma.clinicLocation.update({ where: { id: locationB }, data: { status: 'SUSPENDED' } });
    await expect(
      recordMovement(movement(item.id, locationB, 'RECEIPT', '1')),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_INVENTORY_LOCATION' },
    });
    await expect(
      prisma.inventoryMovement.update({ where: { id: receipt.id }, data: { reason: 'alterado' } }),
    ).rejects.toThrow();
    await expect(prisma.inventoryMovement.delete({ where: { id: receipt.id } })).rejects.toThrow();
    await expect(prisma.$executeRaw`TRUNCATE TABLE inventory_movements`).rejects.toThrow();
    await prisma.clinicLocation.update({ where: { id: locationB }, data: { status: 'ACTIVE' } });
  });

  it('keeps lot requirements and batch identity constrained by the database', async () => {
    const item = await createItem({ lotTracking: true });
    await expect(
      recordMovement(movement(item.id, locationA, 'RECEIPT', '1')),
    ).rejects.toMatchObject({
      response: { code: 'INVENTORY_BATCH_REQUIRED' },
    });
    const receipt = await recordMovement(
      movement(item.id, locationA, 'RECEIPT', '1', { newBatch: { lotNumber: `FIXED-${suffix}` } }),
    );
    await expect(
      prisma.inventoryBatch.update({
        where: { id: receipt.inventoryBatchId! },
        data: { lotNumber: 'CAMBIADO' },
      }),
    ).rejects.toThrow();
  });
});
