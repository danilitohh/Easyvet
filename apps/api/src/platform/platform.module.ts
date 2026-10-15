import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../infrastructure/database/prisma.module';
import { UsersModule } from '../users/users.module';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

// Platform routes are isolated from tenant controllers and never imply tenant access.
@Module({
  imports: [AuthModule, AuthorizationModule, PrismaModule, UsersModule],
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
