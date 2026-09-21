import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { DewormingDetail, DewormingListResponse } from '@veterinary-saas/contracts';
import { CurrentTenant } from '../authorization/current-tenant.decorator';
import { PermissionGuard } from '../authorization/permission.guard';
import { PERMISSIONS } from '../authorization/permissions';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import type { TenantContext } from '../authorization/authorization.types';
import { TenantContextGuard } from '../authorization/tenant-context.guard';
import {
  CreateDewormingDto,
  DewormingListQueryDto,
  FinalizeDewormingDto,
  UpdateDewormingDto,
  VoidDewormingDto,
} from './deworming.dto';
import { DewormingsService } from './dewormings.service';

// Deworming routes expose only aggregate operations; no child or delete endpoints exist.
@Controller()
@UseGuards(TenantContextGuard, PermissionGuard)
export class DewormingsController {
  constructor(private readonly dewormings: DewormingsService) {}

  @Get('patients/:patientId/dewormings')
  @RequirePermissions(PERMISSIONS.CLINICAL.DEWORMINGS_READ)
  listByPatient(
    @CurrentTenant() tenant: TenantContext,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Query() query: DewormingListQueryDto,
  ): Promise<DewormingListResponse> {
    return this.dewormings.listByPatient(tenant, patientId, query);
  }

  @Get('dewormings/:dewormingId')
  @RequirePermissions(PERMISSIONS.CLINICAL.DEWORMINGS_READ)
  findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('dewormingId', new ParseUUIDPipe()) dewormingId: string,
  ): Promise<DewormingDetail> {
    return this.dewormings.findOne(tenant, dewormingId);
  }

  @Post('clinical-encounters/:encounterId/dewormings')
  @RequirePermissions(PERMISSIONS.CLINICAL.DEWORMINGS_CREATE)
  create(
    @CurrentTenant() tenant: TenantContext,
    @Param('encounterId', new ParseUUIDPipe()) encounterId: string,
    @Body() body: CreateDewormingDto,
  ): Promise<DewormingDetail> {
    return this.dewormings.create(tenant, encounterId, body);
  }

  @Patch('dewormings/:dewormingId')
  @RequirePermissions(PERMISSIONS.CLINICAL.DEWORMINGS_UPDATE_DRAFT)
  updateDraft(
    @CurrentTenant() tenant: TenantContext,
    @Param('dewormingId', new ParseUUIDPipe()) dewormingId: string,
    @Body() body: UpdateDewormingDto,
  ): Promise<DewormingDetail> {
    return this.dewormings.updateDraft(tenant, dewormingId, body);
  }

  @Post('dewormings/:dewormingId/finalize')
  @RequirePermissions(PERMISSIONS.CLINICAL.DEWORMINGS_FINALIZE)
  finalize(
    @CurrentTenant() tenant: TenantContext,
    @Param('dewormingId', new ParseUUIDPipe()) dewormingId: string,
    @Body() body: FinalizeDewormingDto,
  ): Promise<DewormingDetail> {
    return this.dewormings.finalize(tenant, dewormingId, body);
  }

  @Post('dewormings/:dewormingId/void')
  @RequirePermissions(PERMISSIONS.CLINICAL.DEWORMINGS_VOID)
  void(
    @CurrentTenant() tenant: TenantContext,
    @Param('dewormingId', new ParseUUIDPipe()) dewormingId: string,
    @Body() body: VoidDewormingDto,
  ): Promise<DewormingDetail> {
    return this.dewormings.void(tenant, dewormingId, body);
  }
}
