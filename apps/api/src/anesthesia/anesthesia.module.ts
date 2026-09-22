import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../infrastructure/database/prisma.module';
import { AnesthesiaController } from './anesthesia.controller';
import { AnesthesiaService } from './anesthesia.service';

// Anesthesia is an API-only backend module in 6F.2B; frontend screens arrive later.
@Module({
  imports: [AuthorizationModule, PrismaModule],
  controllers: [AnesthesiaController],
  providers: [AnesthesiaService],
})
export class AnesthesiaModule {}
