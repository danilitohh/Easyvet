import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FollowUpsController } from './follow-ups.controller';
import { FollowUpsService } from './follow-ups.service';

// Follow-up lifecycle and tenant authorization are kept in one isolated API module.
@Module({
  imports: [AuthorizationModule],
  controllers: [FollowUpsController],
  providers: [FollowUpsService],
})
export class FollowUpsModule {}
