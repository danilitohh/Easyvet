import { Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus, OrganizationStatus, Prisma, UserStatus } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../infrastructure/database/prisma.service';
import {
  AuthenticatedMembership,
  AuthenticatedRequestContext,
  AuthenticatedUser,
} from './auth.types';

type SessionWithContext = Prisma.SessionGetPayload<{
  include: {
    user: true;
    activeMembership: { include: { organization: true } };
  };
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
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });

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
      include: {
        user: true,
        activeMembership: { include: { organization: true } },
      },
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
    };
  }

  private toMembership(
    membership: Prisma.MembershipGetPayload<{ include: { organization: true } }>,
  ): AuthenticatedMembership {
    return {
      id: membership.id,
      role: membership.role,
      status: membership.status,
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
      },
    };
  }
}
