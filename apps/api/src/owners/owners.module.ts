import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../infrastructure/database/prisma.module';
import { OwnersController } from './owners.controller';
import { OwnersService } from './owners.service';

// Owners owns the first veterinary domain aggregate while reusing shared tenant authorization.
@Module({
  imports: [PrismaModule, AuthorizationModule],
  controllers: [OwnersController],
  providers: [OwnersService],
  exports: [OwnersService],
})
export class OwnersModule {}
