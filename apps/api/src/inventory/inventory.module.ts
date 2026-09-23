import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

// Inventory owns catalog, batches and ledger operations without coupling to Sales or Clinical services.
@Module({
  imports: [AuthorizationModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
