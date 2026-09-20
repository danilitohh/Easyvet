import { Module } from '@nestjs/common';
import { PrismaModule } from '../infrastructure/database/prisma.module';
import { MembershipsService } from './memberships.service';

// Encapsulates the user-to-organization relationship and its future tenant boundary.
@Module({
  imports: [PrismaModule],
  providers: [MembershipsService],
  exports: [MembershipsService],
})
export class MembershipsModule {}
