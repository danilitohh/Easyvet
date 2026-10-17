import { Global, Module } from '@nestjs/common';
import { DatabaseSecurityContext } from './database-security-context';
import { DatabaseSecurityMiddleware } from './database-security.middleware';
import { PrismaService } from './prisma.service';

// A global technical module avoids premature domain modules while keeping one Prisma client.
@Global()
@Module({
  providers: [DatabaseSecurityContext, DatabaseSecurityMiddleware, PrismaService],
  exports: [DatabaseSecurityContext, DatabaseSecurityMiddleware, PrismaService],
})
export class PrismaModule {}
