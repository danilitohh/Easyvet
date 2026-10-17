import { describe, expect, it, jest } from '@jest/globals';
import { MembershipStatus, OrganizationStatus, PlatformRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { SessionsService } from './sessions.service';

describe('SessionsService projections', () => {
  it('loads only the fields needed to build the authenticated context', async () => {
    type SessionQuery = { where: Record<string, string>; select: Record<string, unknown> };
    type SessionResult = {
      id: string;
      activeMembershipId: null;
      expiresAt: Date;
      revokedAt: null;
      user: {
        id: string;
        email: string;
        status: UserStatus;
        platformRole: PlatformRole;
        mustChangePassword: boolean;
      };
      activeMembership: null;
    };
    const findUnique = jest.fn<(query: SessionQuery) => Promise<SessionResult | null>>();
    findUnique.mockResolvedValue({
      id: 'session-id',
      activeMembershipId: null,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user: {
        id: 'user-id',
        email: 'owner@example.test',
        status: UserStatus.ACTIVE,
        platformRole: PlatformRole.USER,
        mustChangePassword: false,
      },
      activeMembership: null,
    });
    const update = jest.fn<() => Promise<void>>();
    update.mockResolvedValue(undefined);
    const prisma = { session: { findUnique, update } } as unknown as PrismaService;
    const service = new SessionsService(prisma);

    const context = await service.contextForSession('session-id');

    expect(context?.user).toEqual({
      id: 'user-id',
      email: 'owner@example.test',
      platformRole: PlatformRole.USER,
      mustChangePassword: false,
    });
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-id' },
        select: expect.objectContaining({
          user: expect.objectContaining({
            select: {
              id: true,
              email: true,
              status: true,
              platformRole: true,
              mustChangePassword: true,
            },
          }),
          activeMembership: expect.objectContaining({ select: expect.any(Object) }),
        }),
      }),
    );
    const select = findUnique.mock.calls[0]?.[0]?.select;
    if (!select) throw new Error('Expected session projection');
    const userSelect = (select.user as { select: Record<string, unknown> }).select;
    expect(userSelect).not.toHaveProperty('passwordHash');
    expect(select).not.toHaveProperty('tokenHash');
  });

  it('returns only active memberships from active organizations with a bounded projection', async () => {
    type MembershipQuery = { where: Record<string, unknown>; select: Record<string, unknown> };
    type MembershipResult = {
      id: string;
      role: 'OWNER';
      clinicalRole: null;
      status: MembershipStatus;
      organization: {
        id: string;
        name: string;
        slug: string;
        status: OrganizationStatus;
      };
    }[];
    const findMany = jest.fn<(query: MembershipQuery) => Promise<MembershipResult>>();
    findMany.mockResolvedValue([
      {
        id: 'membership-id',
        role: 'OWNER',
        clinicalRole: null,
        status: MembershipStatus.ACTIVE,
        organization: {
          id: 'organization-id',
          name: 'Easyvet',
          slug: 'easyvet',
          status: OrganizationStatus.ACTIVE,
        },
      },
    ]);
    const prisma = { membership: { findMany } } as unknown as PrismaService;
    const service = new SessionsService(prisma);

    const memberships = await service.getActiveMemberships('user-id');

    expect(memberships[0]).toMatchObject({
      id: 'membership-id',
      organization: { id: 'organization-id', name: 'Easyvet', slug: 'easyvet' },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-id',
          status: MembershipStatus.ACTIVE,
          organization: { status: OrganizationStatus.ACTIVE },
        },
        select: expect.objectContaining({
          organization: expect.objectContaining({
            select: { id: true, name: true, slug: true, status: true },
          }),
        }),
      }),
    );
  });
});
