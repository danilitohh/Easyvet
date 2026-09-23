import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../infrastructure/database/prisma.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

// Reports depend on read-only tenant authorization and database aggregates.
@Module({
  imports: [PrismaModule, AuthorizationModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
