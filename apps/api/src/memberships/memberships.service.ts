import { Injectable } from '@nestjs/common';
import { ClinicalRole, MembershipRole, MembershipStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../infrastructure/database/prisma.service';

export type CreateMembershipInput = {
  userId: string;
  organizationId: string;
  role?: MembershipRole;
  clinicalRole?: ClinicalRole | null;
  status?: MembershipStatus;
};

// Provides explicit membership writes; duplicate protection is delegated to the database constraint.
@Injectable()
export class MembershipsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateMembershipInput) {
    const data: Prisma.MembershipCreateInput = {
      role: input.role ?? MembershipRole.RECEPTION,
      clinicalRole: input.clinicalRole ?? null,
      status: input.status ?? MembershipStatus.INVITED,
      user: { connect: { id: input.userId } },
      organization: { connect: { id: input.organizationId } },
    };

    return this.prisma.membership.create({ data });
  }

  findForUser(userId: string) {
    return this.prisma.membership.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Returns only membership data visible inside the current tenant.
  findForOrganization(organizationId: string) {
    return this.prisma.membership.findMany({
      where: { organizationId },
      select: {
        id: true,
        role: true,
        clinicalRole: true,
        status: true,
        user: { select: { id: true, email: true, status: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // The tenant filter is part of the lookup, preventing IDOR across organizations.
  findByIdForOrganization(organizationId: string, membershipId: string) {
    return this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId },
      select: {
        id: true,
        role: true,
        clinicalRole: true,
        status: true,
        user: { select: { id: true, email: true, status: true } },
      },
    });
  }
}
