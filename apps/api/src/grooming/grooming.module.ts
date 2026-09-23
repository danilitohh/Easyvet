import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { GroomingController } from './grooming.controller';
import { GroomingService } from './grooming.service';

// Grooming lifecycle and access checks remain isolated from clinical and commercial modules.
@Module({
  imports: [AuthorizationModule],
  controllers: [GroomingController],
  providers: [GroomingService],
})
export class GroomingModule {}
