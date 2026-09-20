import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../infrastructure/database/prisma.module';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

// Patients owns the first tenant-scoped clinical-adjacent resource without introducing clinical history.
@Module({
  imports: [PrismaModule, AuthorizationModule],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}
