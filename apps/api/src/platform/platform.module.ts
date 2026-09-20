import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PlatformController } from './platform.controller';

// Platform routes are isolated from tenant controllers and never imply tenant access.
@Module({
  imports: [AuthorizationModule],
  controllers: [PlatformController],
})
export class PlatformModule {}
