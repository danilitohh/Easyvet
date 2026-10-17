import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus, OrganizationStatus, Prisma, UserStatus } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../infrastructure/database/prisma.service';
import {
  AuthenticatedMembership,
  AuthenticatedRequestContext,
  AuthenticatedUser,
} from './auth.types';
import { permissionsForRole } from '../authorization/permissions';

export const MAX_ACTIVE_MEMBERSHIPS = 100;

const membershipContextSelect = {
  id: true,
  role: true,
  clinicalRole: true,
  status: true,
  organization: {
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
    },
  },
} satisfies Prisma.MembershipSelect;

const sessionContextSelect = {
  id: true,
  activeMembershipId: true,
  expiresAt: true,
  revokedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      status: true,
      platformRole: true,
      mustChangePassword: true,
    },
  },
  activeMembership: { select: membershipContextSelect },
} satisfies Prisma.SessionSelect;

type SessionWithContext = Prisma.SessionGetPayload<{ select: typeof sessionContextSelect }>;
type MembershipWithContext = Prisma.MembershipGetPayload<{
  select: typeof membershipContextSelect;
}>;

// Owns opaque session tokens, lifecycle checks, and explicit organization context switching.
@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, activeMembershipId: string | null, ttlMilliseconds: number) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + ttlMilliseconds);
    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash: this.hashToken(token),
        activeMembershipId,
        expiresAt,
      },
      select: { id: true, expiresAt: true },
    });

    return { token, sessionId: session.id, expiresAt: session.expiresAt };
  }

  async authenticate(token: string): Promise<AuthenticatedRequestContext | null> {
    return this.loadContext({ tokenHash: this.hashToken(token) });
  }

  async contextForSession(sessionId: string): Promise<AuthenticatedRequestContext | null> {
    return this.loadContext({ id: sessionId });
  }

  async getActiveMemberships(userId: string): Promise<AuthenticatedMembership[]> {
    const memberships = await this.prisma.membership.findMany({
      where: {
        userId,
        status: MembershipStatus.ACTIVE,
        organization: { status: OrganizationStatus.ACTIVE },
      },
      select: membershipContextSelect,
      orderBy: { createdAt: 'asc' },
      // Fetch one extra row so an oversized context is rejected instead of
      // silently hiding organizations from the selector.
      take: MAX_ACTIVE_MEMBERSHIPS + 1,
    });

    if (memberships.length > MAX_ACTIVE_MEMBERSHIPS) {
      throw new BadRequestException({
        code: 'ORGANIZATION_MEMBERSHIP_LIMIT_REACHED',
        message: 'Organization membership limit reached. Contact support before signing in.',
      });
    }

    return memberships.map((membership) => this.toMembership(membership));
  }

  async switchMembership(sessionId: string, userId: string, membershipId: string): Promise<void> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        id: membershipId,
        userId,
        status: MembershipStatus.ACTIVE,
        organization: { status: OrganizationStatus.ACTIVE },
      },
      select: { id: true },
    });

    if (!membership) {
      // A 404 avoids revealing whether another user's membership exists.
      throw new NotFoundException('Membership not found');
    }

    await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { activeMembershipId: membership.id },
    });
  }

  async revokeByToken(token: string | undefined): Promise<void> {
    if (!token) {
      return;
    }

    await this.prisma.session.updateMany({
      where: { tokenHash: this.hashToken(token), revokedAt: null },
      data: { revokedAt: new Date(), activeMembershipId: null },
    });
  }

  toResponse(context: AuthenticatedRequestContext, memberships: AuthenticatedMembership[]) {
    return {
      user: context.user,
      activeMembership: context.activeMembership,
      memberships,
      organizationSelectionRequired: memberships.length > 1 && context.activeMembership === null,
    };
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  private async loadContext(
    where: Prisma.SessionWhereUniqueInput,
  ): Promise<AuthenticatedRequestContext | null> {
    const session = await this.prisma.session.findUnique({
      where,
      select: sessionContextSelect,
    });

    if (!session || !this.isSessionUsable(session)) {
      return null;
    }

    const activeMembership = this.getUsableMembership(session);
    if (session.activeMembershipId && !activeMembership) {
      // A suspended organization or membership loses tenant context without revoking identity.
      await this.prisma.session.update({
        where: { id: session.id },
        data: { activeMembershipId: null, lastSeenAt: new Date() },
      });
    } else {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      });
    }

    return {
      sessionId: session.id,
      user: this.toUser(session),
      activeMembership,
    };
  }

  private isSessionUsable(session: SessionWithContext): boolean {
    return (
      session.revokedAt === null &&
      session.expiresAt.getTime() > Date.now() &&
      session.user.status === UserStatus.ACTIVE
    );
  }

  private getUsableMembership(session: SessionWithContext): AuthenticatedMembership | null {
    const membership = session.activeMembership;
    if (
      !membership ||
      membership.status !== MembershipStatus.ACTIVE ||
      membership.organization.status !== OrganizationStatus.ACTIVE
    ) {
      return null;
    }

    return this.toMembership(membership);
  }

  private toUser(session: SessionWithContext): AuthenticatedUser {
    return {
      id: session.user.id,
      email: session.user.email,
      platformRole: session.user.platformRole,
      mustChangePassword: session.user.mustChangePassword,
    };
  }

  private toMembership(membership: MembershipWithContext): AuthenticatedMembership {
    return {
      id: membership.id,
      role: membership.role,
      clinicalRole: membership.clinicalRole,
      status: membership.status,
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
      },
      permissions: permissionsForRole(membership.role, membership.clinicalRole),
    };
  }
}
