import { describe, expect, it, jest } from '@jest/globals';
import { ReportsService } from './reports.service';

const organizationId = '11111111-1111-4111-8111-111111111111';

function decimal(value: string) {
  return { toString: () => value };
}

// Deterministic aggregates make currency grouping and UTC civil boundaries directly observable.
function createPrismaMock() {
  const saleGroupBy = jest
    .fn(async (_query: unknown) => [] as unknown[])
    .mockResolvedValueOnce([
      {
        currencyCode: 'COP',
        _count: { _all: 2 },
        _sum: { grandTotal: decimal('150000'), discountTotal: decimal('5000') },
        _avg: { grandTotal: decimal('75000') },
      },
      {
        currencyCode: 'USD',
        _count: { _all: 1 },
        _sum: { grandTotal: decimal('20'), discountTotal: decimal('2') },
        _avg: { grandTotal: decimal('20') },
      },
    ])
    .mockResolvedValueOnce([
      {
        currencyCode: 'COP',
        _count: { _all: 1 },
        _sum: { grandTotal: decimal('10000') },
      },
    ]);
  const prisma = {
    organization: { findFirst: jest.fn(async () => ({ timezone: 'America/Bogota' })) },
    clinicLocation: {
      findFirst: jest.fn(async () => ({ id: '22222222-2222-4222-8222-222222222222' })),
    },
    sale: { groupBy: saleGroupBy },
    $queryRaw: jest.fn(async () => [
      { currencyCode: 'COP', method: 'CASH', total: '140000' },
      { currencyCode: 'USD', method: 'CARD', total: '20' },
    ]),
    invoice: {
      count: jest
        .fn(async () => 0)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1),
    },
    cashSession: {
      groupBy: jest.fn(async () => [
        { currencyCode: 'USD', _count: { _all: 2 }, _sum: { differenceAmount: decimal('-5') } },
      ]),
    },
  };
  return { prisma, saleGroupBy };
}

describe('ReportsService', () => {
  it('keeps commercial totals separated by currency and interprets civil dates in organization time', async () => {
    const { prisma, saleGroupBy } = createPrismaMock();
    const service = new ReportsService(prisma as never);

    const report = await service.commercial(organizationId, {
      from: '2030-01-08',
      to: '2030-01-08',
      clinicLocationId: '22222222-2222-4222-8222-222222222222',
    });

    expect(report.range).toEqual({
      from: '2030-01-08',
      to: '2030-01-08',
      timezone: 'America/Bogota',
      clinicLocationId: '22222222-2222-4222-8222-222222222222',
    });
    expect(report.totalsByCurrency).toEqual([
      {
        currencyCode: 'COP',
        completedSales: 2,
        voidedSales: 1,
        revenue: '150000',
        discounts: '5000',
        averageTicket: '75000',
        voidedValue: '10000',
      },
      {
        currencyCode: 'USD',
        completedSales: 1,
        voidedSales: 0,
        revenue: '20',
        discounts: '2',
        averageTicket: '20',
        voidedValue: '0',
      },
    ]);
    expect(report.paymentsByCurrency).toEqual([
      { currencyCode: 'COP', method: 'CASH', total: '140000' },
      { currencyCode: 'USD', method: 'CARD', total: '20' },
    ]);
    expect(report.totalsByCurrency).not.toHaveProperty('total');
    expect(report.cashSessionsByCurrency).toEqual([
      { currencyCode: 'USD', closedSessions: 2, difference: '-5' },
    ]);

    const [completedSalesQuery] = saleGroupBy.mock.calls;
    expect(completedSalesQuery?.[0]).toMatchObject({
      by: ['currencyCode'],
      where: {
        organizationId,
        clinicLocationId: '22222222-2222-4222-8222-222222222222',
        completedAt: {
          gte: new Date('2030-01-08T05:00:00.000Z'),
          lt: new Date('2030-01-09T05:00:00.000Z'),
        },
      },
    });
  });
});
