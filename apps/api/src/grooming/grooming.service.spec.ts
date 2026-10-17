import { describe, expect, it, jest } from '@jest/globals';
import { MembershipRole } from '@prisma/client';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { GroomingGroomerListQueryDto } from './grooming.dto';
import { GroomingService } from './grooming.service';

describe('GroomingService groomer lookup', () => {
  it('searches and paginates eligible members within the organization', async () => {
    const findMany = jest
      .fn<
        (..._args: unknown[]) => Promise<
          Array<{
            id: string;
            role: MembershipRole;
            professionalProfile: { displayName: string } | null;
          }>
        >
      >()
      .mockResolvedValue([
        {
          id: '10000000-0000-4000-8000-000000000001',
          role: MembershipRole.GROOMER,
          professionalProfile: { displayName: 'Ana Groomer' },
        },
      ]);
    const count = jest.fn<(..._args: unknown[]) => Promise<number>>().mockResolvedValue(41);
    const prisma = { membership: { findMany, count } } as unknown as PrismaService;
    const service = new GroomingService(prisma);
    const query = Object.assign(new GroomingGroomerListQueryDto(), {
      page: 3,
      pageSize: 20,
      search: 'Ana',
    });

    const result = await service.groomers('20000000-0000-4000-8000-000000000001', query);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: '20000000-0000-4000-8000-000000000001',
          professionalProfile: {
            displayName: { contains: 'Ana', mode: 'insensitive' },
          },
        }),
        skip: 40,
        take: 20,
      }),
    );
    expect(count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.any(Object) }));
    expect(result).toEqual({
      data: [
        {
          id: '10000000-0000-4000-8000-000000000001',
          role: MembershipRole.GROOMER,
          displayName: 'Ana Groomer',
        },
      ],
      pagination: { page: 3, pageSize: 20, total: 41, totalPages: 3 },
    });
  });
});
