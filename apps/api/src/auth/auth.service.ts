import { Injectable, UnauthorizedException } from '@nestjs/common';
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
}
