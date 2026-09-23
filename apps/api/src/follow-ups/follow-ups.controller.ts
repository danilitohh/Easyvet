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
import type {
  ClinicalFollowUpDashboard,
  ClinicalFollowUpDetail,
  ClinicalFollowUpListResponse,
} from '@veterinary-saas/contracts';
import { CurrentTenant } from '../authorization/current-tenant.decorator';
import type { TenantContext } from '../authorization/authorization.types';
import { PermissionGuard } from '../authorization/permission.guard';
import { PERMISSIONS } from '../authorization/permissions';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { TenantContextGuard } from '../authorization/tenant-context.guard';
import {
  ClinicalFollowUpListQueryDto,
  CompleteClinicalFollowUpDto,
  CreateClinicalFollowUpDto,
  UpdateClinicalFollowUpDto,
  VoidClinicalFollowUpDto,
} from './follow-ups.dto';
import { FollowUpsService } from './follow-ups.service';

// Routes expose only explicit lifecycle actions; no physical deletion endpoint is provided.
@Controller()
@UseGuards(TenantContextGuard, PermissionGuard)
export class FollowUpsController {
  constructor(private readonly followUps: FollowUpsService) {}

  // The global queue and dashboard share the same tenant-bound read capability.
  @Get('follow-ups/dashboard')
  @RequirePermissions(PERMISSIONS.CLINICAL.FOLLOW_UPS_READ)
  dashboard(@CurrentTenant() tenant: TenantContext): Promise<ClinicalFollowUpDashboard> {
    return this.followUps.dashboard(tenant);
  }

  // Lists operational work using bounded filters and pagination.
  @Get('follow-ups')
  @RequirePermissions(PERMISSIONS.CLINICAL.FOLLOW_UPS_READ)
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ClinicalFollowUpListQueryDto,
  ): Promise<ClinicalFollowUpListResponse> {
    return this.followUps.list(tenant, query);
  }

  // Patient history retains all lifecycle states and is visible only within the active tenant.
  @Get('patients/:patientId/follow-ups')
  @RequirePermissions(PERMISSIONS.CLINICAL.FOLLOW_UPS_READ)
  listByPatient(
    @CurrentTenant() tenant: TenantContext,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Query() query: ClinicalFollowUpListQueryDto,
  ): Promise<ClinicalFollowUpListResponse> {
    return this.followUps.listByPatient(tenant, patientId, query);
  }

  // Detail is a stable global deep link and remains tenant scoped by the service.
  @Get('follow-ups/:followUpId')
  @RequirePermissions(PERMISSIONS.CLINICAL.FOLLOW_UPS_READ)
  findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('followUpId', new ParseUUIDPipe()) followUpId: string,
  ): Promise<ClinicalFollowUpDetail> {
    return this.followUps.findOne(tenant, followUpId);
  }

  // A new follow-up is always attached to a Patient selected by the caller.
  @Post('patients/:patientId/follow-ups')
  @RequirePermissions(PERMISSIONS.CLINICAL.FOLLOW_UPS_CREATE)
  create(
    @CurrentTenant() tenant: TenantContext,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Body() body: CreateClinicalFollowUpDto,
  ): Promise<ClinicalFollowUpDetail> {
    return this.followUps.create(tenant, patientId, body);
  }

  // Open tasks support compare-and-swap edits only.
  @Patch('follow-ups/:followUpId')
  @RequirePermissions(PERMISSIONS.CLINICAL.FOLLOW_UPS_UPDATE)
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('followUpId', new ParseUUIDPipe()) followUpId: string,
    @Body() body: UpdateClinicalFollowUpDto,
  ): Promise<ClinicalFollowUpDetail> {
    return this.followUps.update(tenant, followUpId, body);
  }

  // Completion records a Practitioner-authored outcome and immutable clinical snapshots.
  @Post('follow-ups/:followUpId/complete')
  @RequirePermissions(PERMISSIONS.CLINICAL.FOLLOW_UPS_COMPLETE)
  complete(
    @CurrentTenant() tenant: TenantContext,
    @Param('followUpId', new ParseUUIDPipe()) followUpId: string,
    @Body() body: CompleteClinicalFollowUpDto,
  ): Promise<ClinicalFollowUpDetail> {
    return this.followUps.complete(tenant, followUpId, body);
  }

  // Voiding preserves history and records a required correction reason.
  @Post('follow-ups/:followUpId/void')
  @RequirePermissions(PERMISSIONS.CLINICAL.FOLLOW_UPS_VOID)
  void(
    @CurrentTenant() tenant: TenantContext,
    @Param('followUpId', new ParseUUIDPipe()) followUpId: string,
    @Body() body: VoidClinicalFollowUpDto,
  ): Promise<ClinicalFollowUpDetail> {
    return this.followUps.void(tenant, followUpId, body.expectedVersion, body.reason);
  }
}
