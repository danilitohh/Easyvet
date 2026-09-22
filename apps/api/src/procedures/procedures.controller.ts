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
  ClinicalProcedureDetail,
  ClinicalProcedureListResponse,
} from '@veterinary-saas/contracts';
import { CurrentTenant } from '../authorization/current-tenant.decorator';
import type { TenantContext } from '../authorization/authorization.types';
import { PermissionGuard } from '../authorization/permission.guard';
import { PERMISSIONS } from '../authorization/permissions';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { TenantContextGuard } from '../authorization/tenant-context.guard';
import {
  ClinicalProcedureListQueryDto,
  ClinicalProcedureVersionDto,
  CreateClinicalProcedureDto,
  UpdateClinicalProcedureDto,
  VoidClinicalProcedureDto,
} from './procedure.dto';
import { ProceduresService } from './procedures.service';

// Routes expose procedure aggregate operations; surgery details have no standalone endpoints.
@Controller()
@UseGuards(TenantContextGuard, PermissionGuard)
export class ProceduresController {
  constructor(private readonly procedures: ProceduresService) {}

  @Get('patients/:patientId/procedures')
  @RequirePermissions(PERMISSIONS.CLINICAL.PROCEDURES_READ)
  listByPatient(
    @CurrentTenant() tenant: TenantContext,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Query() query: ClinicalProcedureListQueryDto,
  ): Promise<ClinicalProcedureListResponse> {
    return this.procedures.listByPatient(tenant, patientId, query);
  }

  @Get('procedures/:procedureId')
  @RequirePermissions(PERMISSIONS.CLINICAL.PROCEDURES_READ)
  findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('procedureId', new ParseUUIDPipe()) procedureId: string,
  ): Promise<ClinicalProcedureDetail> {
    return this.procedures.findOne(tenant, procedureId);
  }

  @Post('clinical-encounters/:encounterId/procedures')
  @RequirePermissions(PERMISSIONS.CLINICAL.PROCEDURES_CREATE)
  create(
    @CurrentTenant() tenant: TenantContext,
    @Param('encounterId', new ParseUUIDPipe()) encounterId: string,
    @Body() body: CreateClinicalProcedureDto,
  ): Promise<ClinicalProcedureDetail> {
    return this.procedures.create(tenant, encounterId, body);
  }

  @Patch('procedures/:procedureId')
  @RequirePermissions(PERMISSIONS.CLINICAL.PROCEDURES_UPDATE_DRAFT)
  updateDraft(
    @CurrentTenant() tenant: TenantContext,
    @Param('procedureId', new ParseUUIDPipe()) procedureId: string,
    @Body() body: UpdateClinicalProcedureDto,
  ): Promise<ClinicalProcedureDetail> {
    return this.procedures.updateDraft(tenant, procedureId, body);
  }

  @Post('procedures/:procedureId/finalize')
  @RequirePermissions(PERMISSIONS.CLINICAL.PROCEDURES_FINALIZE)
  finalize(
    @CurrentTenant() tenant: TenantContext,
    @Param('procedureId', new ParseUUIDPipe()) procedureId: string,
    @Body() body: ClinicalProcedureVersionDto,
  ): Promise<ClinicalProcedureDetail> {
    return this.procedures.finalize(tenant, procedureId, body);
  }

  @Post('procedures/:procedureId/void')
  @RequirePermissions(PERMISSIONS.CLINICAL.PROCEDURES_VOID)
  void(
    @CurrentTenant() tenant: TenantContext,
    @Param('procedureId', new ParseUUIDPipe()) procedureId: string,
    @Body() body: VoidClinicalProcedureDto,
  ): Promise<ClinicalProcedureDetail> {
    return this.procedures.void(tenant, procedureId, body);
  }
}
