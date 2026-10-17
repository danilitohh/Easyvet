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
  GroomingGroomerListResponse,
  GroomingVisit,
  GroomingVisitListResponse,
} from '@veterinary-saas/contracts';
import { CurrentTenant } from '../authorization/current-tenant.decorator';
import type { TenantContext } from '../authorization/authorization.types';
import { PermissionGuard } from '../authorization/permission.guard';
import { PERMISSIONS } from '../authorization/permissions';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { TenantContextGuard } from '../authorization/tenant-context.guard';
import {
  CompleteGroomingVisitDto,
  CreateGroomingVisitDto,
  GroomingGroomerListQueryDto,
  GroomingVisitListQueryDto,
  StartGroomingVisitDto,
  UpdateGroomingVisitDto,
  VoidGroomingVisitDto,
} from './grooming.dto';
import { GroomingService } from './grooming.service';

// Every route requires an active tenant and an explicit operation-specific permission.
@Controller()
@UseGuards(TenantContextGuard, PermissionGuard)
export class GroomingController {
  constructor(private readonly grooming: GroomingService) {}

  // Assignment search reveals only active eligible memberships and uses the grooming capability.
  @Get('grooming/groomers')
  @RequirePermissions(PERMISSIONS.GROOMING.READ)
  groomers(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: GroomingGroomerListQueryDto,
  ): Promise<GroomingGroomerListResponse> {
    return this.grooming.groomers(tenant.organizationId, query);
  }

  // Global queue is bounded and filtered within the active Organization.
  @Get('grooming-visits')
  @RequirePermissions(PERMISSIONS.GROOMING.READ)
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: GroomingVisitListQueryDto,
  ): Promise<GroomingVisitListResponse> {
    return this.grooming.list(tenant, query);
  }

  // Patient history exposes all grooming lifecycle states without joining clinical records.
  @Get('patients/:patientId/grooming-visits')
  @RequirePermissions(PERMISSIONS.GROOMING.READ)
  listByPatient(
    @CurrentTenant() tenant: TenantContext,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Query() query: GroomingVisitListQueryDto,
  ): Promise<GroomingVisitListResponse> {
    return this.grooming.listByPatient(tenant, patientId, query);
  }

  // Visit deep links remain tenant safe and return 404 for another tenant's identifier.
  @Get('grooming-visits/:groomingVisitId')
  @RequirePermissions(PERMISSIONS.GROOMING.READ)
  findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('groomingVisitId', new ParseUUIDPipe()) groomingVisitId: string,
  ): Promise<GroomingVisit> {
    return this.grooming.findOne(tenant, groomingVisitId);
  }

  // Creation derives owner history, tenant and audit actor exclusively from server context.
  @Post('patients/:patientId/grooming-visits')
  @RequirePermissions(PERMISSIONS.GROOMING.CREATE)
  create(
    @CurrentTenant() tenant: TenantContext,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Body() body: CreateGroomingVisitDto,
  ): Promise<GroomingVisit> {
    return this.grooming.create(tenant, patientId, body);
  }

  // PATCH uses expectedVersion; mutable references are limited to drafts by the domain service.
  @Patch('grooming-visits/:groomingVisitId')
  @RequirePermissions(PERMISSIONS.GROOMING.UPDATE_DRAFT)
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('groomingVisitId', new ParseUUIDPipe()) groomingVisitId: string,
    @Body() body: UpdateGroomingVisitDto,
  ): Promise<GroomingVisit> {
    return this.grooming.update(tenant, groomingVisitId, body);
  }

  // Starting freezes patient, historical owner and assigned groomer snapshots atomically.
  @Post('grooming-visits/:groomingVisitId/start')
  @RequirePermissions(PERMISSIONS.GROOMING.PERFORM)
  start(
    @CurrentTenant() tenant: TenantContext,
    @Param('groomingVisitId', new ParseUUIDPipe()) groomingVisitId: string,
    @Body() body: StartGroomingVisitDto,
  ): Promise<GroomingVisit> {
    return this.grooming.start(tenant, groomingVisitId, body.expectedVersion);
  }

  // Completion is an explicit lifecycle action and retains operational observations.
  @Post('grooming-visits/:groomingVisitId/complete')
  @RequirePermissions(PERMISSIONS.GROOMING.COMPLETE)
  complete(
    @CurrentTenant() tenant: TenantContext,
    @Param('groomingVisitId', new ParseUUIDPipe()) groomingVisitId: string,
    @Body() body: CompleteGroomingVisitDto,
  ): Promise<GroomingVisit> {
    return this.grooming.complete(tenant, groomingVisitId, body);
  }

  // Void preserves the record and reason; there is intentionally no physical delete route.
  @Post('grooming-visits/:groomingVisitId/void')
  @RequirePermissions(PERMISSIONS.GROOMING.VOID)
  void(
    @CurrentTenant() tenant: TenantContext,
    @Param('groomingVisitId', new ParseUUIDPipe()) groomingVisitId: string,
    @Body() body: VoidGroomingVisitDto,
  ): Promise<GroomingVisit> {
    return this.grooming.void(tenant, groomingVisitId, body);
  }
}
