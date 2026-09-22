import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { StorageModule } from '../storage/storage.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

// Documents combine tenant authorization, immutable metadata, PDF rendering, and private object storage.
@Module({
  imports: [AuthorizationModule, StorageModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
