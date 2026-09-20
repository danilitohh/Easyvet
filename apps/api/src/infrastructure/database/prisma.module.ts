import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// A global technical module avoids premature domain modules while keeping one Prisma client.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
