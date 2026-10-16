import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MembershipRole,
  MembershipStatus,
  Prisma,
  SubscriptionInterval,
  SubscriptionStatus,
  UserStatus,
} from '@prisma/client';
import type { Environment } from '../config/env';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { UsersService } from '../users/users.service';
import { AccountEmailService } from './account-email.service';
import { AuthActionTokenService } from './auth-action-token.service';
import { PasswordService } from './password.service';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
const LEGAL_CONSENT_VERSION = '2026-10-16-draft';

// Owns public account creation, email verification and password recovery for global User identities.
@Injectable()
export class AccountLifecycleService {
  private readonly logger = new Logger(AccountLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly tokens: AuthActionTokenService,
    private readonly email: AccountEmailService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async register(input: {
    displayName: string;
    clinicName: string;
    email: string;
    password: string;
    privacyConsent: boolean;
    termsConsent: boolean;
  }) {
    if (!input.privacyConsent || !input.termsConsent) {
      throw new BadRequestException({
        code: 'LEGAL_CONSENT_REQUIRED',
        message: 'Legal consent is required',
      });
    }
    await this.email.ensureAvailable();
    const email = this.users.normalizeEmail(input.email);
    const existing = await this.users.findByEmail(email);
    if (existing) {
      if (existing.status === UserStatus.PENDING_VERIFICATION) {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            privacyConsentAt: new Date(),
            termsConsentAt: new Date(),
            legalConsentVersion: LEGAL_CONSENT_VERSION,
          },
        });
        await this.sendVerification(email, existing.id, existing.passwordHash);
        return { success: true as const };
      }
      throw new ConflictException({
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'This email is already registered',
      });
    }

    const passwordHash = await this.passwords.hash(input.password);
    const consentedAt = new Date();
    try {
      const userId = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            status: UserStatus.PENDING_VERIFICATION,
            privacyConsentAt: consentedAt,
            termsConsentAt: consentedAt,
            legalConsentVersion: LEGAL_CONSENT_VERSION,
          },
          select: { id: true },
        });
        const clinicName = input.clinicName.trim();
        const organization = await tx.organization.create({
          data: {
            name: clinicName,
            slug: `${slugify(clinicName)}-${randomBytes(4).toString('hex')}`,
            timezone: 'America/Bogota',
            locale: 'es-CO',
            currencyCode: this.config.get('DEFAULT_CURRENCY_CODE', { infer: true }),
          },
        });
        const freePlan = await tx.subscriptionPlan.findUnique({
          where: { code: 'ESSENTIAL' },
          select: { id: true },
        });
        if (!freePlan) {
          throw new InternalServerErrorException({ code: 'SUBSCRIPTION_PLAN_CATALOG_MISSING' });
        }
        await tx.organizationSubscription.create({
          data: {
            organizationId: organization.id,
            planId: freePlan.id,
            status: SubscriptionStatus.ACTIVE,
            interval: SubscriptionInterval.NONE,
          },
        });
        await tx.organizationCommercialSettings.create({
          data: {
            organizationId: organization.id,
            currencyCode: organization.currencyCode,
            invoicePrefix: this.config.get('DEFAULT_INVOICE_PREFIX', { infer: true }),
          },
        });
        await tx.clinicLocation.create({
          data: { organizationId: organization.id, name: 'Sede principal' },
        });
        const membership = await tx.membership.create({
          data: {
            userId: user.id,
            organizationId: organization.id,
            role: MembershipRole.OWNER,
            status: MembershipStatus.ACTIVE,
          },
          select: { id: true },
        });
        await tx.membershipProfessionalProfile.create({
          data: {
            organizationId: organization.id,
            membershipId: membership.id,
            displayName: input.displayName.trim(),
          },
        });
        return user.id;
      });

      await this.sendVerification(email, userId, passwordHash);
      return { success: true as const };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const concurrentUser = await this.users.findByEmail(email);
        if (concurrentUser?.status === UserStatus.PENDING_VERIFICATION) {
          await this.sendVerification(email, concurrentUser.id, concurrentUser.passwordHash);
          return { success: true as const };
        }
        throw new ConflictException({
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'This email is already registered',
        });
      }
      throw error;
    }
  }

  async verifyEmail(token: string) {
    const userId = this.tokens.readUserId(token);
    if (!userId) throw invalidActionLink();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !this.tokens.verify(token, user.passwordHash, 'verify-email')) {
      throw invalidActionLink();
    }
    if (user.status === UserStatus.ACTIVE) return { success: true as const };
    if (user.status !== UserStatus.PENDING_VERIFICATION) throw invalidActionLink();

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`;
      const current = await tx.user.findUnique({ where: { id: user.id } });
      if (
        !current ||
        current.status !== UserStatus.PENDING_VERIFICATION ||
        current.passwordHash !== user.passwordHash ||
        !this.tokens.verify(token, current.passwordHash, 'verify-email')
      ) {
        throw invalidActionLink();
      }
      await tx.user.update({
        where: { id: current.id },
        data: { status: UserStatus.ACTIVE },
      });
    });
    return { success: true as const };
  }

  async resendVerification(emailInput: string) {
    await this.email.ensureAvailable();
    const email = this.users.normalizeEmail(emailInput);
    const user = await this.users.findByEmail(email);
    if (user?.status === UserStatus.PENDING_VERIFICATION) {
      try {
        await this.sendVerification(email, user.id, user.passwordHash);
      } catch (error) {
        this.logger.error('Could not deliver account verification email.', error);
      }
    }
    return { success: true as const };
  }

  async requestPasswordReset(emailInput: string) {
    await this.email.ensureAvailable();
    const email = this.users.normalizeEmail(emailInput);
    const user = await this.users.findByEmail(email);
    if (user?.status === UserStatus.ACTIVE) {
      const token = this.tokens.create(
        user.id,
        user.passwordHash,
        'password-reset',
        PASSWORD_RESET_TTL_MS,
      );
      try {
        await this.email.sendPasswordReset(email, this.actionUrl('/restablecer-contrasena', token));
      } catch (error) {
        this.logger.error('Could not deliver password reset email.', error);
      }
    }
    // The response is identical for known and unknown accounts to prevent email enumeration.
    return { success: true as const };
  }

  async resetPassword(token: string, newPassword: string) {
    const userId = this.tokens.readUserId(token);
    if (!userId) throw invalidActionLink();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      !this.tokens.verify(token, user.passwordHash, 'password-reset')
    ) {
      throw invalidActionLink();
    }
    if (newPassword.length < 12 || newPassword.length > 128) {
      throw new BadRequestException({
        code: 'PASSWORD_POLICY_FAILED',
        message: 'Password must contain between 12 and 128 characters',
      });
    }
    const passwordHash = await this.passwords.hash(newPassword);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`;
      const current = await tx.user.findUnique({ where: { id: user.id } });
      if (
        !current ||
        current.status !== UserStatus.ACTIVE ||
        current.passwordHash !== user.passwordHash ||
        !this.tokens.verify(token, current.passwordHash, 'password-reset')
      ) {
        throw invalidActionLink();
      }
      await tx.user.update({
        where: { id: current.id },
        data: { passwordHash, mustChangePassword: false },
      });
      await tx.session.updateMany({
        where: { userId: current.id, revokedAt: null },
        data: { revokedAt: now, activeMembershipId: null },
      });
    });
    return { success: true as const };
  }

  private async sendVerification(email: string, userId: string, passwordHash: string) {
    const token = this.tokens.create(
      userId,
      passwordHash,
      'verify-email',
      EMAIL_VERIFICATION_TTL_MS,
    );
    await this.email.sendVerification(email, this.actionUrl('/verificar-correo', token));
  }

  private actionUrl(path: string, token: string): string {
    const url = new URL(path, this.config.get('APP_ORIGIN', { infer: true }));
    url.searchParams.set('token', token);
    return url.toString();
  }
}

function invalidActionLink(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'ACCOUNT_ACTION_LINK_INVALID',
    message: 'This link is invalid or has expired',
  });
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return slug || 'clinica';
}
