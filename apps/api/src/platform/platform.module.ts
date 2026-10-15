import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../infrastructure/database/prisma.module';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

// Platform routes are isolated from tenant controllers and never imply tenant access.
@Module({
  imports: [AuthorizationModule, PrismaModule],
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
