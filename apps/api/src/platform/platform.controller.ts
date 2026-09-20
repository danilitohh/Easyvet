import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { PlatformAdminGuard } from '../authorization/platform-admin.guard';

// Platform context contains only technical identity; it never exposes tenant or clinical data.
@Controller('platform')
@UseGuards(PlatformAdminGuard)
export class PlatformController {
  @Get('context')
  context(@Req() request: AuthenticatedRequest) {
    return {
      userId: request.auth!.user.id,
      platformRole: request.auth!.user.platformRole,
    };
  }
}
