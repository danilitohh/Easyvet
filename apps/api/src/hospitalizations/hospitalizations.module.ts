import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { HospitalizationsController } from './hospitalizations.controller';
import { HospitalizationsService } from './hospitalizations.service';

// Keeps the hospitalization aggregate and authorization boundary inside one API module.
@Module({
  imports: [AuthorizationModule],
  controllers: [HospitalizationsController],
  providers: [HospitalizationsService],
})
export class HospitalizationsModule {}
