import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  CashMovementListResponse,
  CashSession,
  CashSessionDetail,
  CashSessionListResponse,
} from '@veterinary-saas/contracts';
import { CurrentTenant } from '../authorization/current-tenant.decorator';
import type { TenantContext } from '../authorization/authorization.types';
import { PERMISSIONS } from '../authorization/permissions';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { TenantContextGuard } from '../authorization/tenant-context.guard';
import {
  CashMovementListQueryDto,
  CashSessionListQueryDto,
  CloseCashSessionDto,
  CreateCashMovementDto,
  OpenCashSessionDto,
} from './commercial.dto';
import { CashSessionsService } from './cash-sessions.service';

// Cash operations use separate permissions for reading, opening, posting movements and closing.
@Controller('cash-sessions')
@UseGuards(TenantContextGuard, PermissionGuard)
export class CashSessionsController {
  constructor(private readonly cashSessions: CashSessionsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CASH.READ)
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: CashSessionListQueryDto,
  ): Promise<CashSessionListResponse> {
    return this.cashSessions.list(tenant.organizationId, query);
  }

  @Get('current')
  @RequirePermissions(PERMISSIONS.CASH.READ)
  current(
    @CurrentTenant() tenant: TenantContext,
    @Query('clinicLocationId', new ParseUUIDPipe()) clinicLocationId: string,
  ): Promise<CashSession | null> {
    return this.cashSessions.current(tenant.organizationId, clinicLocationId);
  }

  @Get(':cashSessionId')
  @RequirePermissions(PERMISSIONS.CASH.READ)
  findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('cashSessionId', new ParseUUIDPipe()) sessionId: string,
  ): Promise<CashSessionDetail> {
    return this.cashSessions.findOne(tenant.organizationId, sessionId);
  }

  @Get(':cashSessionId/movements')
  @RequirePermissions(PERMISSIONS.CASH.READ)
  movements(
    @CurrentTenant() tenant: TenantContext,
    @Param('cashSessionId', new ParseUUIDPipe()) sessionId: string,
    @Query() query: CashMovementListQueryDto,
  ): Promise<CashMovementListResponse> {
    return this.cashSessions.listMovements(tenant.organizationId, sessionId, query);
  }

  @Post('open')
  @RequirePermissions(PERMISSIONS.CASH.OPEN)
  open(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: OpenCashSessionDto,
  ): Promise<CashSessionDetail> {
    return this.cashSessions.open(tenant, body);
  }

  @Post(':cashSessionId/movements')
  @RequirePermissions(PERMISSIONS.CASH.MOVEMENTS)
  createMovement(
    @CurrentTenant() tenant: TenantContext,
    @Param('cashSessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() body: CreateCashMovementDto,
  ) {
    return this.cashSessions.createMovement(tenant, sessionId, body);
  }

  @Post(':cashSessionId/close')
  @RequirePermissions(PERMISSIONS.CASH.CLOSE)
  close(
    @CurrentTenant() tenant: TenantContext,
    @Param('cashSessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() body: CloseCashSessionDto,
  ): Promise<CashSessionDetail> {
    return this.cashSessions.close(tenant, sessionId, body);
  }
}
