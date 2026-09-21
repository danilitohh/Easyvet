import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ClinicalController } from './clinical.controller';
import { ClinicalService } from './clinical.service';

// ClinicalModule contains only the bounded core API; satellites and frontend flows stay in later phases.
@Module({
  imports: [AuthorizationModule],
  controllers: [ClinicalController],
  providers: [ClinicalService],
  exports: [ClinicalService],
})
export class ClinicalModule {}
