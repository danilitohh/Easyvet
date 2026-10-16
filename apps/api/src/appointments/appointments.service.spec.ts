import { describe, expect, it, jest } from '@jest/globals';
import { AppointmentListQueryDto } from './appointment.dto';
import { AppointmentsService } from './appointments.service';

const organizationId = '00000000-0000-4000-8000-000000000701';

describe('AppointmentsService pagination', () => {
  it('paginates availability rules while keeping the active-rule aggregate global', async () => {
    const findMany = jest.fn<(input: unknown) => Promise<unknown[]>>().mockResolvedValue([]);
    const count = jest
      .fn<(input: unknown) => Promise<number>>()
      .mockResolvedValueOnce(44)
      .mockResolvedValueOnce(12);
    const prisma = {
      availabilityRule: { findMany, count },
    };
    const service = new AppointmentsService(prisma as never);

    const result = await service.listAvailability(organizationId, { page: 3, pageSize: 20 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId },
        skip: 40,
        take: 20,
      }),
    );
    expect(count).toHaveBeenNthCalledWith(1, { where: { organizationId } });
    expect(count).toHaveBeenNthCalledWith(2, {
      where: { organizationId, isActive: true },
    });
    expect(result).toMatchObject({
      activeCount: 12,
      pagination: { page: 3, pageSize: 20, total: 44, totalPages: 3 },
    });
  });

  it('applies tenant, date-range, page and page-size boundaries', async () => {
    const findMany = jest.fn<(input: unknown) => Promise<unknown[]>>().mockResolvedValue([]);
    const count = jest.fn<(input: unknown) => Promise<number>>().mockResolvedValue(125);
    const prisma = {
      appointment: { findMany, count },
      $transaction: jest.fn((operations: readonly Promise<unknown>[]) => Promise.all(operations)),
    };
    const service = new AppointmentsService(prisma as never);
    const query = Object.assign(new AppointmentListQueryDto(), {
      from: '2026-01-01T00:00:00Z',
      to: '2026-01-31T00:00:00Z',
      page: 2,
      pageSize: 25,
    });

    const result = await service.list(organizationId, query);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId,
          startsAt: { lt: new Date('2026-01-31T00:00:00.000Z') },
          endsAt: { gt: new Date('2026-01-01T00:00:00.000Z') },
        },
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        skip: 25,
        take: 25,
      }),
    );
    expect(count).toHaveBeenCalledWith({
      where: {
        organizationId,
        startsAt: { lt: new Date('2026-01-31T00:00:00.000Z') },
        endsAt: { gt: new Date('2026-01-01T00:00:00.000Z') },
      },
    });
    expect(result.pagination).toEqual({ page: 2, pageSize: 25, total: 125, totalPages: 5 });
  });
});
