import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { DewormingsController } from './dewormings.controller';
import { DewormingsService } from './dewormings.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [DewormingsController],
  providers: [DewormingsService],
})
export class DewormingsModule {}
