import { Module } from '@nestjs/common';
import { PrismaModule } from '../infrastructure/database/prisma.module';
import { MembershipsService } from './memberships.service';
import { AuthorizationModule } from '../authorization/authorization.module';
import { MembershipsController } from './memberships.controller';

// Encapsulates the user-to-organization relationship and its future tenant boundary.
@Module({
  imports: [PrismaModule, AuthorizationModule],
  controllers: [MembershipsController],
  providers: [MembershipsService],
  exports: [MembershipsService],
})
export class MembershipsModule {}
