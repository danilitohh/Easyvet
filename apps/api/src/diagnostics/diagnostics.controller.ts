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
  DiagnosticOrderDetail,
  DiagnosticOrderListResponse,
} from '@veterinary-saas/contracts';
import { CurrentTenant } from '../authorization/current-tenant.decorator';
import type { TenantContext } from '../authorization/authorization.types';
import { PermissionGuard } from '../authorization/permission.guard';
import { PERMISSIONS } from '../authorization/permissions';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { TenantContextGuard } from '../authorization/tenant-context.guard';
import {
  CreateDiagnosticOrderDto,
  DiagnosticOrderListQueryDto,
  DiagnosticOrderVersionDto,
  ResultDiagnosticOrderDto,
  UpdateDiagnosticOrderDto,
  VoidDiagnosticOrderDto,
} from './diagnostic.dto';
import { DiagnosticsService } from './diagnostics.service';

// HTTP actions mirror the DiagnosticOrder lifecycle and never expose a delete operation.
@Controller()
@UseGuards(TenantContextGuard, PermissionGuard)
export class DiagnosticsController {
  constructor(private readonly diagnostics: DiagnosticsService) {}

  @Get('patients/:patientId/diagnostic-orders')
  @RequirePermissions(PERMISSIONS.CLINICAL.DIAGNOSTICS_READ)
  listByPatient(
    @CurrentTenant() tenant: TenantContext,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Query() query: DiagnosticOrderListQueryDto,
  ): Promise<DiagnosticOrderListResponse> {
    return this.diagnostics.listByPatient(tenant, patientId, query);
  }

  @Get('diagnostic-orders/:diagnosticOrderId')
  @RequirePermissions(PERMISSIONS.CLINICAL.DIAGNOSTICS_READ)
  findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('diagnosticOrderId', new ParseUUIDPipe()) diagnosticOrderId: string,
  ): Promise<DiagnosticOrderDetail> {
    return this.diagnostics.findOne(tenant, diagnosticOrderId);
  }

  @Post('clinical-encounters/:encounterId/diagnostic-orders')
  @RequirePermissions(PERMISSIONS.CLINICAL.DIAGNOSTICS_CREATE)
  create(
    @CurrentTenant() tenant: TenantContext,
    @Param('encounterId', new ParseUUIDPipe()) encounterId: string,
    @Body() body: CreateDiagnosticOrderDto,
  ): Promise<DiagnosticOrderDetail> {
    return this.diagnostics.create(tenant, encounterId, body);
  }

  @Patch('diagnostic-orders/:diagnosticOrderId')
  @RequirePermissions(PERMISSIONS.CLINICAL.DIAGNOSTICS_UPDATE_DRAFT)
  updateDraft(
    @CurrentTenant() tenant: TenantContext,
    @Param('diagnosticOrderId', new ParseUUIDPipe()) diagnosticOrderId: string,
    @Body() body: UpdateDiagnosticOrderDto,
  ): Promise<DiagnosticOrderDetail> {
    return this.diagnostics.updateDraft(tenant, diagnosticOrderId, body);
  }

  @Post('diagnostic-orders/:diagnosticOrderId/request')
  @RequirePermissions(PERMISSIONS.CLINICAL.DIAGNOSTICS_REQUEST)
  request(
    @CurrentTenant() tenant: TenantContext,
    @Param('diagnosticOrderId', new ParseUUIDPipe()) diagnosticOrderId: string,
    @Body() body: DiagnosticOrderVersionDto,
  ): Promise<DiagnosticOrderDetail> {
    return this.diagnostics.request(tenant, diagnosticOrderId, body.expectedVersion);
  }

  @Post('diagnostic-orders/:diagnosticOrderId/result')
  @RequirePermissions(PERMISSIONS.CLINICAL.DIAGNOSTICS_RESULT)
  result(
    @CurrentTenant() tenant: TenantContext,
    @Param('diagnosticOrderId', new ParseUUIDPipe()) diagnosticOrderId: string,
    @Body() body: ResultDiagnosticOrderDto,
  ): Promise<DiagnosticOrderDetail> {
    return this.diagnostics.result(tenant, diagnosticOrderId, body);
  }

  @Post('diagnostic-orders/:diagnosticOrderId/void')
  @RequirePermissions(PERMISSIONS.CLINICAL.DIAGNOSTICS_VOID)
  void(
    @CurrentTenant() tenant: TenantContext,
    @Param('diagnosticOrderId', new ParseUUIDPipe()) diagnosticOrderId: string,
    @Body() body: VoidDiagnosticOrderDto,
  ): Promise<DiagnosticOrderDetail> {
    return this.diagnostics.void(tenant, diagnosticOrderId, body);
  }
}
