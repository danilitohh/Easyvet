import { Module } from '@nestjs/common';
import { PrismaModule } from '../infrastructure/database/prisma.module';
import { LocationsService } from './locations.service';

// Encapsulates clinic location persistence while keeping Organization as the tenant boundary.
@Module({
  imports: [PrismaModule],
  providers: [LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}
