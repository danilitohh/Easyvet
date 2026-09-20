import { Injectable } from '@nestjs/common';
import { MembershipRole, MembershipStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../infrastructure/database/prisma.service';

export type CreateMembershipInput = {
  userId: string;
  organizationId: string;
  role?: MembershipRole;
  status?: MembershipStatus;
};

// Provides explicit membership writes; duplicate protection is delegated to the database constraint.
@Injectable()
export class MembershipsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateMembershipInput) {
    const data: Prisma.MembershipCreateInput = {
      role: input.role ?? MembershipRole.RECEPTION,
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
}
