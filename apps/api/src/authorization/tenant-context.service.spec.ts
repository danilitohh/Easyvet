import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { MembershipRole, MembershipStatus, OrganizationStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { PrismaService } from '../infrastructure/database/prisma.service';
import type { TenantRequest } from './authorization.types';
import { TenantContextService } from './tenant-context.service';

describe('TenantContextService', () => {
  type MembershipLookup = {
    where: {
      id: string;
      userId: string;
      status: MembershipStatus;
      organization: { status: OrganizationStatus };
    };
    select: {
      id: true;
      userId: true;
      organizationId: true;
      role: true;
      clinicalRole: true;
    };
  };
  const membership = {
    id: 'membership-1',
    userId: 'user-1',
    organizationId: 'organization-from-database',
    role: MembershipRole.OWNER,
    clinicalRole: null,
  };
  const findFirst = jest.fn<(args: MembershipLookup) => Promise<typeof membership | null>>();
  const prisma = { membership: { findFirst } } as unknown as PrismaService;
  const service = new TenantContextService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    findFirst.mockResolvedValue(membership);
  });

  it('revalidates membership ownership and active organization state before creating tenant context', async () => {
    const request = {
      auth: {
        user: { id: 'user-1' },
        activeMembership: { id: 'membership-1' },
      },
    } as TenantRequest;

    await expect(service.resolve(request)).resolves.toEqual({
      organizationId: 'organization-from-database',
      membershipId: 'membership-1',
      role: MembershipRole.OWNER,
      clinicalRole: null,
      userId: 'user-1',
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: 'membership-1',
        userId: 'user-1',
        status: MembershipStatus.ACTIVE,
        organization: { status: OrganizationStatus.ACTIVE },
      },
      select: { id: true, userId: true, organizationId: true, role: true, clinicalRole: true },
    });
  });

  it('ignores a caller-supplied tenant and derives organization identity only from the database', async () => {
    const request = {
      auth: {
        user: { id: 'user-1' },
        activeMembership: { id: 'membership-1' },
      },
      tenant: {
        organizationId: 'attacker-selected-organization',
        membershipId: 'membership-1',
        role: MembershipRole.OWNER,
        clinicalRole: null,
        userId: 'user-1',
      },
    } as TenantRequest;

    await expect(service.resolve(request)).resolves.toMatchObject({
      organizationId: 'organization-from-database',
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1', id: 'membership-1' }),
      }),
    );
  });

  it('fails closed without an authenticated identity and does not query membership data', async () => {
    await expect(service.resolve({} as AuthenticatedRequest)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('rejects missing or inactive memberships and organizations', async () => {
    findFirst.mockResolvedValue(null);
    const request = {
      auth: {
        user: { id: 'user-1' },
        activeMembership: { id: 'membership-1' },
      },
    } as TenantRequest;

    await expect(service.resolve(request)).rejects.toBeInstanceOf(ForbiddenException);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: MembershipStatus.ACTIVE,
          organization: { status: OrganizationStatus.ACTIVE },
        }),
      }),
    );
  });
});
