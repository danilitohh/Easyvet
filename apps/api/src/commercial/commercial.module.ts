import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PrismaModule } from '../infrastructure/database/prisma.module';
import { CashSessionsController } from './cash-sessions.controller';
import { CashSessionsService } from './cash-sessions.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

// Commercial owns Sales/Billing/Cash routes and coordinates Inventory through its public service.
@Module({
  imports: [PrismaModule, AuthorizationModule, InventoryModule],
  controllers: [SalesController, InvoicesController, CashSessionsController],
  providers: [SalesService, InvoicesService, CashSessionsService],
})
export class CommercialModule {}
