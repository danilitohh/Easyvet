import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClinicalRole,
  MembershipRole,
  MembershipStatus,
  OrganizationAuditAction,
  PlatformRole,
  Prisma,
  UserStatus,
} from '@prisma/client';
import { randomInt } from 'node:crypto';
import { PasswordService } from '../auth/password.service';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { UsersService } from '../users/users.service';

export type CreateMembershipInput = {
  userId: string;
  organizationId: string;
  role?: MembershipRole;
  clinicalRole?: ClinicalRole | null;
  status?: MembershipStatus;
};

export type MembershipFilters = {
  page: number;
  pageSize: number;
  status?: MembershipStatus;
  role?: MembershipRole;
  clinicalRole?: ClinicalRole;
  search?: string;
};

export type MembershipPatch = {
  role?: MembershipRole;
  clinicalRole?: ClinicalRole | null;
};

const memberSelect = {
  id: true,
  role: true,
  clinicalRole: true,
  status: true,
  user: { select: { email: true } },
  professionalProfile: { select: { displayName: true } },
} satisfies Prisma.MembershipSelect;

// Provides tenant-scoped staff workflows while leaving global identity controls with Auth/Platform.
@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
  ) {}

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

  // Applies every filter and page boundary in PostgreSQL, keeping searches tenant-local.
  async findPageForOrganization(organizationId: string, filters: MembershipFilters) {
    const normalizedSearch = filters.search?.trim();
    const where: Prisma.MembershipWhereInput = {
      organizationId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.clinicalRole ? { clinicalRole: filters.clinicalRole } : {}),
      ...(normalizedSearch
        ? {
            OR: [
              { user: { email: { contains: normalizedSearch, mode: 'insensitive' } } },
              {
                professionalProfile: {
                  is: { displayName: { contains: normalizedSearch, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.membership.count({ where }),
      this.prisma.membership.findMany({
        where,
        select: memberSelect,
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
    ]);
    return { data, page: filters.page, pageSize: filters.pageSize, total };
  }

  // The tenant filter is part of the lookup, preventing IDOR across organizations.
  findByIdForOrganization(organizationId: string, membershipId: string) {
    return this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId },
      select: memberSelect,
    });
  }

  // Creates one active tenant membership and returns a generated credential only to its winning creator.
  async createStaff(
    organizationId: string,
    actorMembershipId: string,
    actorRole: MembershipRole,
    input: { email: string; role: MembershipRole; clinicalRole: ClinicalRole | null },
  ) {
    this.assertOwnerManagement(actorRole, input.role);
    const email = this.users.normalizeEmail(input.email);
    let temporaryPassword: string | null = null;

    return this.prisma.$transaction(async (tx) => {
      await this.lockOrganization(tx, organizationId);
      let user = await tx.user.findUnique({ where: { email } });
      let accountAlreadyExisted = Boolean(user);

      if (!user) {
        temporaryPassword = this.generateTemporaryPassword();
        const passwordHash = await this.passwords.hash(temporaryPassword);
        const inserted = await tx.user.createMany({
          data: {
            email,
            passwordHash,
            status: UserStatus.ACTIVE,
            platformRole: PlatformRole.USER,
            mustChangePassword: true,
          },
          skipDuplicates: true,
        });
        accountAlreadyExisted = inserted.count === 0;
        user = await tx.user.findUnique({ where: { email } });
      }

      if (!user) {
        throw new ConflictException({ code: 'USER_CREATION_CONFLICT', message: 'Try again' });
      }
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR SHARE`;
      user = await tx.user.findUnique({ where: { id: user.id } });
      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new ConflictException({
          code: 'USER_GLOBAL_SUSPENDED',
          message: 'This account cannot be added to an organization',
        });
      }

      const existingMembership = await tx.membership.findUnique({
        where: { userId_organizationId: { userId: user.id, organizationId } },
        select: { id: true },
      });
      if (existingMembership) {
        throw new ConflictException({
          code: 'MEMBERSHIP_ALREADY_EXISTS',
          message: 'This person already belongs to the organization',
        });
      }

      const membership = await tx.membership.create({
        data: {
          userId: user.id,
          organizationId,
          role: input.role,
          clinicalRole: input.clinicalRole,
          status: MembershipStatus.ACTIVE,
        },
      });
      await this.writeAudit(tx, {
        organizationId,
        actorMembershipId,
        entityType: 'MEMBERSHIP',
        entityId: membership.id,
        action: OrganizationAuditAction.MEMBERSHIP_CREATED,
        metadata: { role: input.role, clinicalRole: input.clinicalRole },
      });
      const response = await tx.membership.findUniqueOrThrow({
        where: { id: membership.id },
        select: memberSelect,
      });
      return {
        membership: response,
        accountAlreadyExisted,
        temporaryPassword: accountAlreadyExisted ? null : temporaryPassword,
      };
    });
  }

  // Serializes owner mutations on the organization row so count-and-write cannot race.
  async updateStaff(
    organizationId: string,
    membershipId: string,
    actorMembershipId: string,
    actorRole: MembershipRole,
    patch: MembershipPatch,
  ) {
    if (patch.role === undefined && patch.clinicalRole === undefined) {
      throw new BadRequestException({
        code: 'EMPTY_MEMBERSHIP_UPDATE',
        message: 'No changes supplied',
      });
    }
    return this.prisma.$transaction(async (tx) => {
      await this.lockOrganization(tx, organizationId);
      const target = await tx.membership.findFirst({
        where: { id: membershipId, organizationId },
      });
      if (!target) throw this.membershipNotFound();
      this.assertOwnerManagement(actorRole, target.role);
      this.assertOwnerManagement(actorRole, patch.role);
      const nextRole = patch.role ?? target.role;
      if (
        target.role === MembershipRole.OWNER &&
        target.status === MembershipStatus.ACTIVE &&
        nextRole !== MembershipRole.OWNER
      ) {
        await this.assertAnotherActiveOwner(tx, organizationId, target.id);
      }
      const updated = await tx.membership.update({
        where: { id: target.id },
        data: {
          ...(patch.role === undefined ? {} : { role: patch.role }),
          ...(patch.clinicalRole === undefined ? {} : { clinicalRole: patch.clinicalRole }),
        },
      });
      await this.writeAudit(tx, {
        organizationId,
        actorMembershipId,
        entityType: 'MEMBERSHIP',
        entityId: updated.id,
        action: OrganizationAuditAction.MEMBERSHIP_ROLE_UPDATED,
        metadata: {
          role: updated.role,
          clinicalRole: updated.clinicalRole,
        },
      });
      return tx.membership.findUniqueOrThrow({ where: { id: updated.id }, select: memberSelect });
    });
  }

  // Suspension revokes only sessions currently using this tenant membership, not global identity access.
  async suspendStaff(
    organizationId: string,
    membershipId: string,
    actorMembershipId: string,
    actorRole: MembershipRole,
  ) {
    return this.updateStatus(
      organizationId,
      membershipId,
      actorMembershipId,
      actorRole,
      MembershipStatus.SUSPENDED,
    );
  }

  async reactivateStaff(
    organizationId: string,
    membershipId: string,
    actorMembershipId: string,
    actorRole: MembershipRole,
  ) {
    return this.updateStatus(
      organizationId,
      membershipId,
      actorMembershipId,
      actorRole,
      MembershipStatus.ACTIVE,
    );
  }

  private async updateStatus(
    organizationId: string,
    membershipId: string,
    actorMembershipId: string,
    actorRole: MembershipRole,
    status: 'ACTIVE' | 'SUSPENDED',
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOrganization(tx, organizationId);
      const target = await tx.membership.findFirst({
        where: { id: membershipId, organizationId },
        include: { user: { select: { status: true } } },
      });
      if (!target) throw this.membershipNotFound();
      this.assertOwnerManagement(actorRole, target.role);
      if (status === MembershipStatus.ACTIVE && target.user.status !== UserStatus.ACTIVE) {
        throw new ConflictException({
          code: 'USER_GLOBAL_SUSPENDED',
          message: 'This account cannot be reactivated in the organization',
        });
      }
      if (
        status === MembershipStatus.SUSPENDED &&
        target.status === MembershipStatus.ACTIVE &&
        target.role === MembershipRole.OWNER
      ) {
        await this.assertAnotherActiveOwner(tx, organizationId, target.id);
      }
      if (target.status === status) {
        return tx.membership.findUniqueOrThrow({ where: { id: target.id }, select: memberSelect });
      }
      const updated = await tx.membership.update({
        where: { id: target.id },
        data: { status },
      });
      if (status === MembershipStatus.SUSPENDED) {
        await tx.session.updateMany({
          where: { activeMembershipId: target.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await this.writeAudit(tx, {
        organizationId,
        actorMembershipId,
        entityType: 'MEMBERSHIP',
        entityId: updated.id,
        action:
          status === MembershipStatus.ACTIVE
            ? OrganizationAuditAction.MEMBERSHIP_REACTIVATED
            : OrganizationAuditAction.MEMBERSHIP_SUSPENDED,
        metadata: { status },
      });
      return tx.membership.findUniqueOrThrow({ where: { id: updated.id }, select: memberSelect });
    });
  }

  private async lockOrganization(tx: Prisma.TransactionClient, organizationId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE
    `;
    if (!rows.length) throw this.membershipNotFound();
  }

  private async assertAnotherActiveOwner(
    tx: Prisma.TransactionClient,
    organizationId: string,
    excludedMembershipId: string,
  ) {
    const count = await tx.membership.count({
      where: {
        organizationId,
        id: { not: excludedMembershipId },
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });
    if (count === 0) {
      throw new ConflictException({
        code: 'LAST_ACTIVE_OWNER_REQUIRED',
        message: 'At least one active owner must remain in the organization',
      });
    }
  }

  private assertOwnerManagement(actorRole: MembershipRole, targetRole?: MembershipRole) {
    if (targetRole === MembershipRole.OWNER && actorRole !== MembershipRole.OWNER) {
      throw new ForbiddenException({
        code: 'OWNER_PERMISSION_REQUIRED',
        message: 'Only an organization owner can manage another owner',
      });
    }
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    event: {
      organizationId: string;
      actorMembershipId: string;
      entityType: string;
      entityId: string;
      action: OrganizationAuditAction;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    await tx.organizationAuditEvent.create({ data: event });
  }

  private generateTemporaryPassword(length = 22): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-_';
    return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join('');
  }

  private membershipNotFound() {
    return new NotFoundException({
      code: 'MEMBERSHIP_NOT_FOUND',
      message: 'Membership not found in this organization',
    });
  }
}
