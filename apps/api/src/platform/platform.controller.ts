import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { PlatformAdminGuard } from '../authorization/platform-admin.guard';
import { PlatformOrganizationsQueryDto, UpdatePlatformOrganizationStatusDto } from './platform.dto';
import { PlatformService } from './platform.service';

// Platform context contains only technical identity; it never exposes tenant or clinical data.
@Controller('platform')
@UseGuards(PlatformAdminGuard)
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('context')
  context(@Req() request: AuthenticatedRequest) {
    return {
      userId: request.auth!.user.id,
      platformRole: request.auth!.user.platformRole,
    };
  }

  @Get('overview')
  overview() {
    return this.platform.overview();
  }

  @Get('organizations')
  organizations(@Query() query: PlatformOrganizationsQueryDto) {
    return this.platform.organizations(query);
  }

  @Patch('organizations/:organizationId/status')
  changeOrganizationStatus(
    @Req() request: AuthenticatedRequest,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Body() body: UpdatePlatformOrganizationStatusDto,
  ) {
    return this.platform.changeOrganizationStatus(organizationId, request.auth!.user.id, body);
  }

  @Get('activity')
  activity() {
    return this.platform.activity();
  }
}
