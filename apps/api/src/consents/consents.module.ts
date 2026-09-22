import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { StorageModule } from '../storage/storage.module';
import { ConsentsController } from './consents.controller';
import { ConsentsService } from './consents.service';
import { PublicSignaturesController } from './public-signatures.controller';

// Consent lifecycle and public signing share one service while keeping public endpoints outside tenant guards.
@Module({
  imports: [AuthorizationModule, StorageModule],
  controllers: [ConsentsController, PublicSignaturesController],
  providers: [ConsentsService],
  exports: [ConsentsService],
})
export class ConsentsModule {}
