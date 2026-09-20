import { Module } from '@nestjs/common';
import { PrismaModule } from '../infrastructure/database/prisma.module';
import { LocationsService } from './locations.service';
import { AuthorizationModule } from '../authorization/authorization.module';
import { LocationsController } from './locations.controller';

// Encapsulates clinic location persistence while keeping Organization as the tenant boundary.
@Module({
  imports: [PrismaModule, AuthorizationModule],
  controllers: [LocationsController],
  providers: [LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}
