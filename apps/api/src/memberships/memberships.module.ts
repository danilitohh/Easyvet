import { Module } from '@nestjs/common';
import { PrismaModule } from '../infrastructure/database/prisma.module';
import { MembershipsService } from './memberships.service';
import { AuthorizationModule } from '../authorization/authorization.module';
import { MembershipsController } from './memberships.controller';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

// Encapsulates the user-to-organization relationship and its future tenant boundary.
@Module({
  imports: [PrismaModule, AuthorizationModule, AuthModule, UsersModule],
  controllers: [MembershipsController],
  providers: [MembershipsService],
  exports: [MembershipsService],
})
export class MembershipsModule {}
