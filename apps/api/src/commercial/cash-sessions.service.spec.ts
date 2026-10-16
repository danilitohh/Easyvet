import { describe, expect, it, jest } from '@jest/globals';
import { CashSessionStatus, Prisma } from '@prisma/client';
import { CashSessionsService } from './cash-sessions.service';

const organizationId = '00000000-0000-4000-8000-000000000601';
const sessionId = '00000000-0000-4000-8000-000000000602';

describe('CashSessionsService detail projection', () => {
  it('does not load the unbounded ledger when reading a session summary', async () => {
    const findMany = jest.fn<(input: unknown) => Promise<unknown[]>>().mockResolvedValue([]);
    const groupBy = jest.fn<(input: unknown) => Promise<unknown[]>>().mockResolvedValue([]);
    const session = {
      id: sessionId,
      organizationId,
      clinicLocationId: '00000000-0000-4000-8000-000000000603',
      status: CashSessionStatus.OPEN,
      currencyCode: 'COP',
      version: 2,
      openingCashAmount: new Prisma.Decimal('50'),
      openedAt: new Date('2026-01-01T10:00:00.000Z'),
      openedByMembershipId: '00000000-0000-4000-8000-000000000604',
      closedAt: null,
      closedByMembershipId: null,
      expectedCashAmount: null,
      countedCashAmount: null,
      differenceAmount: null,
      notes: null,
      clinicLocation: { id: '00000000-0000-4000-8000-000000000603', name: 'Norte' },
    };
    const prisma = {
      cashSession: {
        findFirst: jest
          .fn<(input: unknown) => Promise<typeof session | null>>()
          .mockResolvedValue(session),
      },
      cashMovement: { findMany, groupBy },
    };
    const service = new CashSessionsService(prisma as never);

    const result = await service.findOne(organizationId, sessionId);

    expect(result).toMatchObject({ id: sessionId, clinicLocationName: 'Norte' });
    expect(result).not.toHaveProperty('movements');
    expect(groupBy).toHaveBeenCalledWith({
      by: ['cashSessionId'],
      where: { organizationId, cashSessionId: { in: [sessionId] } },
      _sum: { amountDelta: true },
    });
    expect(findMany).not.toHaveBeenCalled();
  });
});
