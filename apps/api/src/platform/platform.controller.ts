import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { PlatformAdminGuard } from '../authorization/platform-admin.guard';
import {
  AssignPlatformSubscriptionDto,
  PlatformAccountsQueryDto,
  CreatePlatformAdminAccountDto,
  PlatformActivityQueryDto,
  PlatformOrganizationsQueryDto,
  PlatformSubscriptionsQueryDto,
  UpdatePlatformAdminAccountStatusDto,
  UpdatePlatformOrganizationStatusDto,
} from './platform.dto';
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

  @Get('accounts')
  platformAccounts(@Query() query: PlatformAccountsQueryDto) {
    return this.platform.platformAccounts(query);
  }

  @Post('accounts')
  createPlatformAccount(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreatePlatformAdminAccountDto,
  ) {
    return this.platform.createPlatformAccount(request.auth!.user.id, body);
  }

  @Patch('accounts/:userId/status')
  updatePlatformAccountStatus(
    @Req() request: AuthenticatedRequest,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() body: UpdatePlatformAdminAccountStatusDto,
  ) {
    return this.platform.updatePlatformAccountStatus(request.auth!.user.id, userId, body);
  }

  @Get('overview')
  overview() {
    return this.platform.overview();
  }

  @Get('database-posture')
  databasePosture() {
    return this.platform.databasePosture();
  }

  @Get('organizations')
  organizations(@Query() query: PlatformOrganizationsQueryDto) {
    return this.platform.organizations(query);
  }

  @Get('organizations/:organizationId')
  organizationDetail(@Param('organizationId', new ParseUUIDPipe()) organizationId: string) {
    return this.platform.organizationDetail(organizationId);
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
  activity(@Query() query: PlatformActivityQueryDto) {
    return this.platform.activity(query);
  }

  @Get('subscription-plans')
  subscriptionPlans() {
    return this.platform.subscriptionPlans();
  }

  @Get('subscriptions')
  subscriptions(@Query() query: PlatformSubscriptionsQueryDto) {
    return this.platform.subscriptions(query);
  }

  @Put('organizations/:organizationId/subscription')
  assignSubscription(
    @Req() request: AuthenticatedRequest,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Body() body: AssignPlatformSubscriptionDto,
  ) {
    return this.platform.assignSubscription(organizationId, request.auth!.user.id, body);
  }
}
