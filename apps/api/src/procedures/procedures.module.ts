import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ProceduresController } from './procedures.controller';
import { ProceduresService } from './procedures.service';

// Procedures is a backend-only module; clinical UI and adjacent integrations remain deferred.
@Module({
  imports: [AuthorizationModule],
  controllers: [ProceduresController],
  providers: [ProceduresService],
  exports: [ProceduresService],
})
export class ProceduresModule {}
