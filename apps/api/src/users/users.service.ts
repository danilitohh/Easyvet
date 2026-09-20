import { BadRequestException, Injectable } from '@nestjs/common';
import { PlatformRole, Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../infrastructure/database/prisma.service';

export type CreateUserInput = {
  email: string;
  passwordHash: string;
  status?: UserStatus;
  platformRole?: PlatformRole;
};

// Owns the global user boundary and enforces normalized email input before persistence.
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateUserInput) {
    const email = this.normalizeEmail(input.email);
    if (!input.passwordHash.trim()) {
      throw new BadRequestException('passwordHash is required');
    }

    const data: Prisma.UserCreateInput = {
      email,
      passwordHash: input.passwordHash,
      status: input.status ?? UserStatus.ACTIVE,
      platformRole: input.platformRole ?? PlatformRole.USER,
    };

    return this.prisma.user.create({ data });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: this.normalizeEmail(email) } });
  }

  normalizeEmail(email: string): string {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) {
      throw new BadRequestException('A valid email is required');
    }

    return normalized;
  }
}
