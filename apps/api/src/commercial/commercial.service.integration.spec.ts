import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { TenantContext } from '../authorization/authorization.types';
import { InventoryService } from '../inventory/inventory.service';
import { CashSessionsService } from './cash-sessions.service';
import type {
  CloseCashSessionDto,
  CompleteSaleDto,
  CreateCashMovementDto,
  CreateSaleDto,
  OpenCashSessionDto,
  UpdateSaleDto,
} from './commercial.dto';
import { SalesService } from './sales.service';

const describeDatabase = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

// PostgreSQL-only tests are restricted to easyvet_test and cover ledger, tenant and lock invariants.
describeDatabase('commercial services', () => {
  let prisma: PrismaClient;
  let inventory: InventoryService;
  let sales: SalesService;
  let cash: CashSessionsService;
  let organizationId: string;
  let foreignOrganizationId: string;
  let locationId: string;
  let secondLocationId: string;
  let foreignLocationId: string;
  let ownerId: string;
  let patientId: string;
  let foreignOwnerId: string;
  let foreignPatientId: string;
  let tenant: TenantContext;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const organizationIds: string[] = [];
  const userIds: string[] = [];
  const membershipIds: string[] = [];
  const locationIds: string[] = [];
  const ownerIds: string[] = [];
  const patientIds: string[] = [];
  const inventoryItemIds: string[] = [];
  const saleIds: string[] = [];
  const cashSessionIds: string[] = [];

  // Create fake active inventory and an opening receipt without mutating any seed data.
  async function createStock(quantity = '5') {
    const item = await inventory.createItem(organizationId, {
      name: `Producto comercial QA ${suffix}-${inventoryItemIds.length}`,
      itemType: 'RETAIL',
      baseUnit: 'unidad',
      lotTracking: false,
    });
    inventoryItemIds.push(item.id);
    await inventory.createMovement(tenant, {
      inventoryItemId: item.id,
      clinicLocationId: locationId,
      movementType: 'RECEIPT',
      quantity,
      occurredAt: '2035-01-08T15:00:00.000Z',
      reason: 'Existencia ficticia para pruebas comerciales',
    });
    return item.id;
  }

  // Every test sale starts as a tenant-owned draft and only receives the requested fake lines.
  async function createSale(input: CreateSaleDto, actor: TenantContext = tenant) {
    const sale = await sales.create(actor, input);
    if (actor.organizationId === organizationId) saleIds.push(sale.id);
    return sale;
  }

  // Sale completion helper keeps test payments explicit and decimal-safe.
  async function completeSale(
    saleId: string,
    expectedVersion: number,
    payments: CompleteSaleDto['payments'],
  ) {
    return sales.complete(tenant, saleId, { expectedVersion, payments } as CompleteSaleDto);
  }

  beforeAll(async () => {
    const testUrl = process.env.DATABASE_URL_TEST;
    if (!testUrl) throw new Error('DATABASE_URL_TEST is required when RUN_DB_TESTS=1');
    if (new URL(testUrl).pathname.replace(/^\//, '') !== 'easyvet_test') {
      throw new Error('Commercial database tests must use easyvet_test');
    }
    prisma = new PrismaClient({ datasources: { db: { url: testUrl } } });
    await prisma.$connect();
    inventory = new InventoryService(prisma as never);
    sales = new SalesService(prisma as never, inventory);
    cash = new CashSessionsService(prisma as never);

    const [organization, foreignOrganization] = await Promise.all([
      prisma.organization.create({
        data: { name: `Commercial QA ${suffix}`, slug: `commercial-qa-${suffix}` },
      }),
      prisma.organization.create({
        data: { name: `Commercial foreign QA ${suffix}`, slug: `commercial-foreign-qa-${suffix}` },
      }),
    ]);
    organizationId = organization.id;
    foreignOrganizationId = foreignOrganization.id;
    organizationIds.push(organizationId, foreignOrganizationId);
    await Promise.all(
      [organizationId, foreignOrganizationId].map((id) =>
        prisma.organizationCommercialSettings.create({
          data: {
            organizationId: id,
            currencyCode: 'COP',
            invoicePrefix: `QA${id === organizationId ? 'N' : 'F'}`,
          },
        }),
      ),
    );

    const [user, foreignUser] = await Promise.all([
      prisma.user.create({
        data: {
          email: `commercial-owner-${suffix}@example.local`,
          passwordHash: 'integration-only',
        },
      }),
      prisma.user.create({
        data: {
          email: `commercial-foreign-${suffix}@example.local`,
          passwordHash: 'integration-only',
        },
      }),
    ]);
    userIds.push(user.id, foreignUser.id);
    const [membership, foreignMembership] = await Promise.all([
      prisma.membership.create({
        data: { organizationId, userId: user.id, role: 'OWNER', status: 'ACTIVE' },
      }),
      prisma.membership.create({
        data: {
          organizationId: foreignOrganizationId,
          userId: foreignUser.id,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      }),
    ]);
    membershipIds.push(membership.id, foreignMembership.id);
    tenant = {
      organizationId,
      membershipId: membership.id,
      userId: user.id,
      role: 'OWNER',
      clinicalRole: null,
    };

    const [location, secondLocation, foreignLocation] = await Promise.all([
      prisma.clinicLocation.create({ data: { organizationId, name: `Caja QA ${suffix}` } }),
      prisma.clinicLocation.create({ data: { organizationId, name: `Otra sede QA ${suffix}` } }),
      prisma.clinicLocation.create({
        data: { organizationId: foreignOrganizationId, name: `Sede extranjera ${suffix}` },
      }),
    ]);
    locationId = location.id;
    secondLocationId = secondLocation.id;
    foreignLocationId = foreignLocation.id;
    locationIds.push(locationId, secondLocationId, foreignLocationId);

    const [owner, foreignOwner] = await Promise.all([
      prisma.owner.create({
        data: {
          organizationId,
          firstName: 'Camila',
          lastName: 'Rojas',
          documentType: 'NATIONAL_ID',
          documentNumber: `QA-${suffix}`,
        },
      }),
      prisma.owner.create({
        data: {
          organizationId: foreignOrganizationId,
          firstName: 'Persona',
          lastName: 'Extranjera',
        },
      }),
    ]);
    ownerId = owner.id;
    foreignOwnerId = foreignOwner.id;
    ownerIds.push(ownerId, foreignOwnerId);
    const [patient, foreignPatient] = await Promise.all([
      prisma.patient.create({
        data: {
          organizationId,
          ownerId,
          name: 'Luna',
          nameNormalized: `luna ${suffix}`,
          species: 'DOG',
        },
      }),
      prisma.patient.create({
        data: {
          organizationId: foreignOrganizationId,
          ownerId: foreignOwnerId,
          name: 'Milo',
          nameNormalized: `milo ${suffix}`,
          species: 'CAT',
        },
      }),
    ]);
    patientId = patient.id;
    foreignPatientId = foreignPatient.id;
    patientIds.push(patientId, foreignPatientId);
  });

  afterAll(async () => {
    if (!prisma) return;
    try {
      if (organizationIds.length) {
        // Test cleanup disables only this schema's user triggers, then restores them even if cleanup fails.
        const guardedTables = [
          'commercial_audit_events',
          'cash_movements',
          'sale_payments',
          'invoices',
          'sale_items',
          'sales',
          'cash_sessions',
          'inventory_movements',
        ];
        const disabledTables: string[] = [];
        try {
          for (const table of guardedTables) {
            await prisma.$executeRawUnsafe(`ALTER TABLE ${table} DISABLE TRIGGER USER`);
            disabledTables.push(table);
          }
          await prisma.commercialAuditEvent.deleteMany({
            where: { organizationId: { in: organizationIds } },
          });
          await prisma.cashMovement.deleteMany({
            where: { organizationId: { in: organizationIds } },
          });
          await prisma.inventoryMovement.deleteMany({
            where: { organizationId: { in: organizationIds } },
          });
          await prisma.salePayment.deleteMany({
            where: { organizationId: { in: organizationIds } },
          });
          await prisma.invoice.deleteMany({ where: { organizationId: { in: organizationIds } } });
          await prisma.saleItem.deleteMany({ where: { organizationId: { in: organizationIds } } });
          await prisma.sale.deleteMany({ where: { organizationId: { in: organizationIds } } });
          await prisma.cashSession.deleteMany({
            where: { organizationId: { in: organizationIds } },
          });
        } finally {
          for (const table of disabledTables.reverse()) {
            await prisma.$executeRawUnsafe(`ALTER TABLE ${table} ENABLE TRIGGER USER`);
          }
        }
        await prisma.organizationCommercialSettings.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prisma.inventoryBatch.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prisma.inventoryItem.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
        await prisma.owner.deleteMany({ where: { id: { in: ownerIds } } });
        await prisma.clinicLocation.deleteMany({ where: { id: { in: locationIds } } });
        await prisma.membership.deleteMany({ where: { id: { in: membershipIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it('completes and voids mixed tenders atomically with inventory, customer snapshots, invoice and cash reversal', async () => {
    const itemId = await createStock('5');
    const cashSession = await cash.open(tenant, {
      clinicLocationId: locationId,
      openingCashAmount: '100.0000',
      notes: 'Apertura ficticia',
    } as OpenCashSessionDto);
    cashSessionIds.push(cashSession.id);
    const sale = await createSale({
      clinicLocationId: locationId,
      patientId,
      items: [
        {
          itemType: 'PRODUCT',
          inventoryItemId: itemId,
          quantity: '1.000000',
          unitPrice: '12.3456',
          discountAmount: '0.3456',
        },
        {
          itemType: 'SERVICE',
          description: 'Consulta de prueba',
          quantity: '1',
          unitPrice: '3.1250',
          discountAmount: '0',
        },
      ],
    } as CreateSaleDto);
    expect(sale.ownerId).toBe(ownerId);
    expect(sale.grandTotal).toBe('15.1250');

    const updated = await sales.update(tenant, sale.id, {
      clinicLocationId: locationId,
      patientId,
      items: sale.items.map((line) => ({
        itemType: line.itemType,
        inventoryItemId: line.inventoryItemId,
        inventoryBatchId: line.inventoryBatchId,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountAmount: line.discountAmount,
      })),
      expectedVersion: 1,
    } as UpdateSaleDto);
    expect(updated.version).toBe(2);
    await expect(
      sales.update(tenant, sale.id, {
        clinicLocationId: locationId,
        patientId,
        items: [],
        expectedVersion: 1,
      } as UpdateSaleDto),
    ).rejects.toMatchObject({ response: { code: 'SALE_STALE' } });

    const completed = await completeSale(sale.id, 2, [
      { method: 'CASH', amount: '10.0000' },
      { method: 'CARD', amount: '5.1250', reference: 'POS-QA-01' },
    ]);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.customerNameSnapshot).toBe('Camila Rojas');
    expect(completed.customerDocumentNumberSnapshot).toBe(`QA-${suffix}`);
    expect(completed.patientNameSnapshot).toBe('Luna');
    expect(completed.invoice?.documentNumber).toBe('QAN-000001');
    expect(completed.items[0]?.inventoryItemNameSnapshot).toContain('Producto comercial QA');
    expect(
      await prisma.inventoryMovement.count({
        where: { saleId: sale.id, movementType: 'SALE_OUT' },
      }),
    ).toBe(1);
    expect(
      (await inventory.itemStock(organizationId, itemId)).locations.find(
        (row) => row.clinicLocationId === locationId,
      )?.stock,
    ).toBe('4');
    expect((await cash.findOne(organizationId, cashSession.id)).expectedCashAmount).toBe(
      '110.0000',
    );

    const voided = await sales.void(tenant, sale.id, {
      expectedVersion: 3,
      reason: 'Corrección ficticia de QA',
    });
    expect(voided.status).toBe('VOIDED');
    expect(voided.payments.every((payment) => payment.status === 'VOIDED')).toBe(true);
    expect(voided.invoice?.status).toBe('VOIDED');
    expect(
      await prisma.inventoryMovement.count({
        where: { saleId: sale.id, movementType: 'SALE_REVERSAL_IN' },
      }),
    ).toBe(1);
    expect(
      (await inventory.itemStock(organizationId, itemId)).locations.find(
        (row) => row.clinicLocationId === locationId,
      )?.stock,
    ).toBe('5');
    const cashAfterVoid = await cash.findOne(organizationId, cashSession.id);
    expect(cashAfterVoid.expectedCashAmount).toBe('100.0000');
    const closed = await cash.close(tenant, cashSession.id, {
      expectedVersion: cashAfterVoid.version,
      countedCashAmount: '100.0000',
    } as CloseCashSessionDto);
    expect(closed.expectedCashAmount).toBe('100.0000');
    expect(closed.differenceAmount).toBe('0.0000');
  });

  it('rolls back stock, payment and invoice when inventory is insufficient', async () => {
    const itemId = await createStock('1');
    const sale = await createSale({
      clinicLocationId: locationId,
      items: [{ itemType: 'PRODUCT', inventoryItemId: itemId, quantity: '2', unitPrice: '3.0000' }],
    } as CreateSaleDto);
    await expect(completeSale(sale.id, 1, [{ method: 'CARD', amount: '6' }])).rejects.toMatchObject(
      {
        response: { code: 'INSUFFICIENT_STOCK' },
      },
    );
    const unchanged = await sales.findOne(organizationId, sale.id);
    expect(unchanged.status).toBe('DRAFT');
    expect(unchanged.payments).toHaveLength(0);
    expect(unchanged.invoice).toBeNull();
    expect(await prisma.inventoryMovement.count({ where: { saleId: sale.id } })).toBe(0);
  });

  it('serializes competing stock consumption and allocates unique invoice numbers across locations', async () => {
    const itemId = await createStock('1');
    const competingSales = await Promise.all(
      [locationId, locationId].map((clinicLocationId) =>
        createSale({
          clinicLocationId,
          items: [
            { itemType: 'PRODUCT', inventoryItemId: itemId, quantity: '1', unitPrice: '7.0000' },
          ],
        } as CreateSaleDto),
      ),
    );
    const stockResults = await Promise.allSettled(
      competingSales.map((sale) => completeSale(sale.id, 1, [{ method: 'CARD', amount: '7' }])),
    );
    expect(stockResults.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(stockResults.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(
      await prisma.inventoryMovement.count({
        where: { saleId: { in: competingSales.map((sale) => sale.id) }, movementType: 'SALE_OUT' },
      }),
    ).toBe(1);

    const sequenceSales = await Promise.all(
      [locationId, secondLocationId].map((clinicLocationId) =>
        createSale({
          clinicLocationId,
          items: [
            {
              itemType: 'SERVICE',
              description: 'Servicio de secuencia',
              quantity: '1',
              unitPrice: '2',
            },
          ],
        } as CreateSaleDto),
      ),
    );
    const completed = await Promise.all(
      sequenceSales.map((sale) => completeSale(sale.id, 1, [{ method: 'TRANSFER', amount: '2' }])),
    );
    expect(new Set(completed.map((sale) => sale.invoice?.documentNumber)).size).toBe(2);
  });

  it('serializes same-sale completion and void requests without duplicate evidence', async () => {
    const itemId = await createStock('2');
    const sale = await createSale({
      clinicLocationId: locationId,
      items: [{ itemType: 'PRODUCT', inventoryItemId: itemId, quantity: '1', unitPrice: '9' }],
    } as CreateSaleDto);
    const completions = await Promise.allSettled([
      completeSale(sale.id, 1, [{ method: 'CARD', amount: '9' }]),
      completeSale(sale.id, 1, [{ method: 'CARD', amount: '9' }]),
    ]);
    expect(completions.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(completions.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await prisma.invoice.count({ where: { saleId: sale.id } })).toBe(1);
    expect(await prisma.salePayment.count({ where: { saleId: sale.id } })).toBe(1);
    expect(
      await prisma.inventoryMovement.count({
        where: { saleId: sale.id, movementType: 'SALE_OUT' },
      }),
    ).toBe(1);

    const voids = await Promise.allSettled([
      sales.void(tenant, sale.id, { expectedVersion: 2, reason: 'Anulación concurrente A' }),
      sales.void(tenant, sale.id, { expectedVersion: 2, reason: 'Anulación concurrente B' }),
    ]);
    expect(voids.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(voids.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(
      await prisma.inventoryMovement.count({
        where: { saleId: sale.id, movementType: 'SALE_REVERSAL_IN' },
      }),
    ).toBe(1);
    expect(await prisma.invoice.count({ where: { saleId: sale.id, status: 'VOIDED' } })).toBe(1);
  });

  it('allows only one winner when a draft replacement races sale completion', async () => {
    const sale = await createSale({
      clinicLocationId: locationId,
      items: [
        { itemType: 'SERVICE', description: 'Servicio original', quantity: '1', unitPrice: '10' },
      ],
    } as CreateSaleDto);
    const replacement = sales.update(tenant, sale.id, {
      clinicLocationId: locationId,
      items: [
        { itemType: 'SERVICE', description: 'Servicio editado', quantity: '1', unitPrice: '11' },
      ],
      expectedVersion: 1,
    } as UpdateSaleDto);
    const race = await Promise.allSettled([
      replacement,
      completeSale(sale.id, 1, [{ method: 'CARD', amount: '10' }]),
    ]);
    expect(race.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(race.filter((result) => result.status === 'rejected')).toHaveLength(1);

    const finalSale = await sales.findOne(organizationId, sale.id);
    if (finalSale.status === 'COMPLETED') {
      expect(finalSale.items[0]?.description).toBe('Servicio original');
      expect(finalSale.invoice).not.toBeNull();
      expect(finalSale.payments).toHaveLength(1);
    } else {
      expect(finalSale.status).toBe('DRAFT');
      expect(finalSale.version).toBe(2);
      expect(finalSale.items[0]?.description).toBe('Servicio editado');
      expect(finalSale.invoice).toBeNull();
      expect(finalSale.payments).toHaveLength(0);
    }
  });

  it('serializes void against drawer close and preserves the winning cash ledger', async () => {
    const session = await cash.open(tenant, {
      clinicLocationId: secondLocationId,
      openingCashAmount: '0',
    } as OpenCashSessionDto);
    cashSessionIds.push(session.id);
    const sale = await createSale({
      clinicLocationId: secondLocationId,
      items: [
        { itemType: 'SERVICE', description: 'Servicio caja', quantity: '1', unitPrice: '10' },
      ],
    } as CreateSaleDto);
    await completeSale(sale.id, 1, [{ method: 'CASH', amount: '10' }]);

    const race = await Promise.allSettled([
      sales.void(tenant, sale.id, { expectedVersion: 2, reason: 'Void contra cierre' }),
      cash.close(tenant, session.id, {
        expectedVersion: 2,
        countedCashAmount: '10',
      } as CloseCashSessionDto),
    ]);
    expect(race.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(race.filter((result) => result.status === 'rejected')).toHaveLength(1);

    const [finalSale, finalSession] = await Promise.all([
      sales.findOne(organizationId, sale.id),
      cash.findOne(organizationId, session.id),
    ]);
    if (finalSale.status === 'VOIDED') {
      expect(race[1]?.status).toBe('rejected');
      expect(finalSession.status).toBe('OPEN');
      expect(finalSession.expectedCashAmount).toBe('0.0000');
      expect(
        await prisma.cashMovement.count({
          where: { saleId: sale.id, movementType: 'SALE_VOID_REVERSAL' },
        }),
      ).toBe(1);
      const closed = await cash.close(tenant, session.id, {
        expectedVersion: finalSession.version,
        countedCashAmount: '0',
      } as CloseCashSessionDto);
      expect(closed.expectedCashAmount).toBe('0.0000');
      expect(closed.countedCashAmount).toBe('0.0000');
    } else {
      expect(race[1]?.status).toBe('fulfilled');
      expect(finalSale.status).toBe('COMPLETED');
      expect(finalSession.status).toBe('CLOSED');
      expect(finalSession.expectedCashAmount).toBe('10.0000');
      expect(finalSession.countedCashAmount).toBe('10.0000');
      expect(
        await prisma.cashMovement.count({
          where: { saleId: sale.id, movementType: 'SALE_VOID_REVERSAL' },
        }),
      ).toBe(0);
    }
  });

  it('serializes drawer close against cash sales and manual movements', async () => {
    const session = await cash.open(tenant, {
      clinicLocationId: secondLocationId,
      openingCashAmount: '0',
    } as OpenCashSessionDto);
    cashSessionIds.push(session.id);
    const sale = await createSale({
      clinicLocationId: secondLocationId,
      items: [
        { itemType: 'SERVICE', description: 'Servicio de cierre', quantity: '1', unitPrice: '10' },
      ],
    } as CreateSaleDto);
    const saleRace = await Promise.allSettled([
      completeSale(sale.id, 1, [{ method: 'CASH', amount: '10' }]),
      cash.close(tenant, session.id, {
        expectedVersion: 1,
        countedCashAmount: '10',
      } as CloseCashSessionDto),
    ]);
    const afterSaleRace = await cash.findOne(organizationId, session.id);
    if (saleRace[0]?.status === 'fulfilled') {
      expect(saleRace[1]?.status).toBe('rejected');
      expect(afterSaleRace.status).toBe('OPEN');
      const closed = await cash.close(tenant, session.id, {
        expectedVersion: afterSaleRace.version,
        countedCashAmount: '10',
      } as CloseCashSessionDto);
      expect(closed.expectedCashAmount).toBe('10.0000');
    } else {
      expect(saleRace[1]?.status).toBe('fulfilled');
      expect(afterSaleRace.status).toBe('CLOSED');
      expect(saleRace[0]).toMatchObject({
        status: 'rejected',
        reason: { response: { code: 'CASH_SESSION_REQUIRED' } },
      });
      expect(await prisma.salePayment.count({ where: { saleId: sale.id } })).toBe(0);
    }

    const manualSession = await cash.open(tenant, {
      clinicLocationId: locationId,
      openingCashAmount: '5',
    } as OpenCashSessionDto);
    cashSessionIds.push(manualSession.id);
    const movementInput = {
      expectedVersion: 1,
      type: 'MANUAL_OUT',
      amount: '2',
      reason: 'Salida ficticia',
      occurredAt: '2035-01-08T15:00:00.000Z',
    } as CreateCashMovementDto;
    const movementRace = await Promise.allSettled([
      cash.createMovement(tenant, manualSession.id, movementInput),
      cash.close(tenant, manualSession.id, {
        expectedVersion: 1,
        countedCashAmount: '5',
      } as CloseCashSessionDto),
    ]);
    const afterMovementRace = await cash.findOne(organizationId, manualSession.id);
    if (movementRace[0]?.status === 'fulfilled') {
      expect(movementRace[1]?.status).toBe('rejected');
      const closed = await cash.close(tenant, manualSession.id, {
        expectedVersion: afterMovementRace.version,
        countedCashAmount: '3',
      } as CloseCashSessionDto);
      expect(closed.expectedCashAmount).toBe('3.0000');
    } else {
      expect(movementRace[1]?.status).toBe('fulfilled');
      expect(afterMovementRace.status).toBe('CLOSED');
      expect(movementRace[0]).toMatchObject({
        status: 'rejected',
        reason: { response: { code: 'CASH_SESSION_CLOSED' } },
      });
      expect(await prisma.cashMovement.count({ where: { cashSessionId: manualSession.id } })).toBe(
        0,
      );
    }
  });

  it('rejects cross-tenant sale reads and never creates unrelated clinical or agenda rows', async () => {
    const before = await prisma.appointment.count({ where: { organizationId } });
    const sale = await createSale({
      clinicLocationId: locationId,
      ownerId,
      items: [
        { itemType: 'OTHER', description: 'Venta sin paciente', quantity: '1', unitPrice: '1' },
      ],
    } as CreateSaleDto);
    await expect(sales.findOne(foreignOrganizationId, sale.id)).rejects.toMatchObject({
      response: { code: 'RESOURCE_NOT_FOUND' },
    });
    await expect(
      createSale({
        clinicLocationId: locationId,
        patientId: foreignPatientId,
        items: [],
      } as CreateSaleDto),
    ).rejects.toMatchObject({ response: { code: 'RESOURCE_NOT_FOUND' } });
    expect(await prisma.appointment.count({ where: { organizationId } })).toBe(before);
    expect(await prisma.clinicalEncounter.count({ where: { organizationId } })).toBe(0);
    expect(foreignLocationId).not.toBe(locationId);
  });
});
