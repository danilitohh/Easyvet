import { createHash, timingSafeEqual } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PlatformAuditAction, PlatformRole, UserStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/env';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { UsersService } from '../users/users.service';
import { PasswordService } from './password.service';
import type { PlatformAdminBootstrapDto } from './auth.dto';

// A high-entropy deployment secret gates the single account that bootstraps the platform.
@Injectable()
export class PlatformAdminBootstrapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async createFirstAdmin(input: PlatformAdminBootstrapDto) {
    const expectedSecret = this.config.get('PLATFORM_ADMIN_BOOTSTRAP_SECRET', { infer: true });
    if (!expectedSecret) throw new NotFoundException();

    const suppliedDigest = createHash('sha256').update(input.bootstrapSecret).digest();
    const expectedDigest = createHash('sha256').update(expectedSecret).digest();
    if (!timingSafeEqual(suppliedDigest, expectedDigest)) {
      throw new UnauthorizedException({ code: 'INVALID_BOOTSTRAP_CREDENTIAL' });
    }

    const email = this.users.normalizeEmail(input.email);
    const passwordHash = await this.passwords.hash(input.password);

    return this.prisma.$transaction(async (tx) => {
      // Serialize first-admin attempts so two requests cannot both pass the empty-platform check.
      // Keep PostgreSQL's void-returning lock call inside a CTE and return an int to Prisma.
      await tx.$queryRaw<Array<{ acquired: number }>>`
        WITH bootstrap_lock AS MATERIALIZED (
          SELECT pg_advisory_xact_lock(783419205612::bigint)
        )
        SELECT 1::int AS acquired FROM bootstrap_lock
      `;
      const existingAdminCount = await tx.user.count({
        where: { platformRole: PlatformRole.PLATFORM_ADMIN },
      });
      if (existingAdminCount > 0) {
        throw new ConflictException({ code: 'PLATFORM_ALREADY_INITIALIZED' });
      }

      const existingUser = await tx.user.findUnique({ where: { email }, select: { id: true } });
      if (existingUser) throw new ConflictException({ code: 'EMAIL_ALREADY_REGISTERED' });

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          platformRole: PlatformRole.PLATFORM_ADMIN,
          status: UserStatus.ACTIVE,
        },
        select: { id: true, email: true },
      });
      await tx.platformAuditEvent.create({
        data: {
          actorUserId: user.id,
          action: PlatformAuditAction.PLATFORM_ADMIN_BOOTSTRAPPED,
          metadata: { email: user.email },
        },
      });

      return { success: true as const };
    });
  }
}
