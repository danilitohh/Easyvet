import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { UsersService } from '../users/users.service';
import { PasswordService } from './password.service';
import { AuthenticatedRequestContext } from './auth.types';
import { SessionCookieService } from './session-cookie.service';
import { SessionsService } from './sessions.service';

// Coordinates credential verification without exposing password or session internals to controllers.
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionsService,
    private readonly cookies: SessionCookieService,
  ) {}

  async login(email: string, password: string) {
    const normalizedEmail = this.users.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    const validPassword = user ? await this.passwords.verify(user.passwordHash, password) : false;

    if (!user || user.status !== UserStatus.ACTIVE || !validPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const memberships = await this.sessions.getActiveMemberships(user.id);
    const onlyMembership = memberships.length === 1 ? memberships[0] : undefined;
    const activeMembershipId = onlyMembership?.id ?? null;
    const session = await this.sessions.create(
      user.id,
      activeMembershipId,
      this.cookies.ttlMilliseconds,
    );
    const context = await this.sessions.contextForSession(session.sessionId);
    if (!context) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      token: session.token,
      expiresAt: session.expiresAt,
      response: this.sessions.toResponse(context, memberships),
    };
  }

  me(context: AuthenticatedRequestContext) {
    return this.sessions
      .getActiveMemberships(context.user.id)
      .then((memberships) => this.sessions.toResponse(context, memberships));
  }

  async switchOrganization(context: AuthenticatedRequestContext, membershipId: string) {
    await this.sessions.switchMembership(context.sessionId, context.user.id, membershipId);
    const nextContext = await this.sessions.contextForSession(context.sessionId);
    if (!nextContext) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    const memberships = await this.sessions.getActiveMemberships(context.user.id);
    return this.sessions.toResponse(nextContext, memberships);
  }

  // Revalidates the credential under a row lock before changing it to avoid racing another update.
  async changePassword(
    context: AuthenticatedRequestContext,
    currentPassword: string,
    newPassword: string,
  ) {
    if (newPassword.length < 12 || newPassword.length > 128) {
      throw new BadRequestException({
        code: 'PASSWORD_POLICY_FAILED',
        message: 'Password must contain between 12 and 128 characters',
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id: context.user.id } });
    if (!user || !(await this.passwords.verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException({
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'Current password is incorrect',
      });
    }
    const passwordHash = await this.passwords.hash(newPassword);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${context.user.id}::uuid FOR UPDATE`;
      const current = await tx.user.findUnique({ where: { id: context.user.id } });
      if (
        !current ||
        current.passwordHash !== user.passwordHash ||
        current.status !== UserStatus.ACTIVE
      ) {
        throw new UnauthorizedException({
          code: 'INVALID_CURRENT_PASSWORD',
          message: 'Current password is incorrect',
        });
      }
      await tx.user.update({
        where: { id: current.id },
        data: { passwordHash, mustChangePassword: false },
      });
      await tx.session.updateMany({
        where: { userId: current.id, id: { not: context.sessionId }, revokedAt: null },
        data: { revokedAt: now, activeMembershipId: null },
      });
    });
    return { success: true as const };
  }
}
