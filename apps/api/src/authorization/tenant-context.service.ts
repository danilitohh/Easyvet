import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { MembershipStatus, OrganizationStatus } from '@prisma/client';
import { PrismaService } from '../infrastructure/database/prisma.service';
import type { TenantContext, TenantRequest } from './authorization.types';

function activeOrganizationRequired(): ForbiddenException {
  return new ForbiddenException({
    code: 'ACTIVE_ORGANIZATION_REQUIRED',
    message: 'An active organization is required',
  });
}

// Revalidates the session-selected membership against both ownership and current tenant state.
@Injectable()
export class TenantContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(request: TenantRequest): Promise<TenantContext> {
    const auth = request.auth;
    if (!auth) {
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
    }
    if (!auth.activeMembership) {
      throw activeOrganizationRequired();
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        id: auth.activeMembership.id,
        userId: auth.user.id,
        status: MembershipStatus.ACTIVE,
        organization: { status: OrganizationStatus.ACTIVE },
      },
      select: { id: true, userId: true, organizationId: true, role: true },
    });
    if (!membership) {
      throw activeOrganizationRequired();
    }

    return {
      organizationId: membership.organizationId,
      membershipId: membership.id,
      role: membership.role,
      userId: membership.userId,
    };
  }
}
