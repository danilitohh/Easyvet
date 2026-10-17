import { afterEach, describe, expect, it } from '@jest/globals';
import { DatabaseSecurityContext } from './database-security-context';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let prisma: PrismaService | undefined;

  afterEach(async () => {
    if (prisma && typeof prisma.$disconnect === 'function') {
      await prisma.$disconnect();
    }
    prisma = undefined;
  });

  it('keeps Prisma lifecycle methods after adding the scoped query extension', () => {
    prisma = new PrismaService(new DatabaseSecurityContext());

    expect(typeof prisma.$connect).toBe('function');
    expect(typeof prisma.$disconnect).toBe('function');
    expect(typeof prisma.onModuleInit).toBe('function');
    expect(typeof prisma.onModuleDestroy).toBe('function');
  });
});
