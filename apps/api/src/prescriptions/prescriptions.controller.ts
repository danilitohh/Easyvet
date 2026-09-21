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
import type { PrescriptionDetail, PrescriptionListResponse } from '@veterinary-saas/contracts';
import { CurrentTenant } from '../authorization/current-tenant.decorator';
import { PermissionGuard } from '../authorization/permission.guard';
import { PERMISSIONS } from '../authorization/permissions';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import type { TenantContext } from '../authorization/authorization.types';
import { TenantContextGuard } from '../authorization/tenant-context.guard';
import {
  CreatePrescriptionDto,
  PrescriptionListQueryDto,
  PrescriptionVersionDto,
  UpdatePrescriptionDto,
  VoidPrescriptionDto,
} from './prescription.dto';
import { PrescriptionsService } from './prescriptions.service';

// Prescription routes expose only aggregate operations; items never have standalone endpoints.
@Controller()
@UseGuards(TenantContextGuard, PermissionGuard)
export class PrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @Get('patients/:patientId/prescriptions')
  @RequirePermissions(PERMISSIONS.CLINICAL.PRESCRIPTIONS_READ)
  listByPatient(
    @CurrentTenant() tenant: TenantContext,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Query() query: PrescriptionListQueryDto,
  ): Promise<PrescriptionListResponse> {
    return this.prescriptions.listByPatient(tenant, patientId, query);
  }

  @Get('prescriptions/:prescriptionId')
  @RequirePermissions(PERMISSIONS.CLINICAL.PRESCRIPTIONS_READ)
  findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('prescriptionId', new ParseUUIDPipe()) prescriptionId: string,
  ): Promise<PrescriptionDetail> {
    return this.prescriptions.findOne(tenant, prescriptionId);
  }

  @Post('clinical-encounters/:encounterId/prescriptions')
  @RequirePermissions(PERMISSIONS.CLINICAL.PRESCRIPTIONS_CREATE)
  create(
    @CurrentTenant() tenant: TenantContext,
    @Param('encounterId', new ParseUUIDPipe()) encounterId: string,
    @Body() body: CreatePrescriptionDto,
  ): Promise<PrescriptionDetail> {
    return this.prescriptions.create(tenant, encounterId, body);
  }

  @Patch('prescriptions/:prescriptionId')
  @RequirePermissions(PERMISSIONS.CLINICAL.PRESCRIPTIONS_UPDATE_DRAFT)
  updateDraft(
    @CurrentTenant() tenant: TenantContext,
    @Param('prescriptionId', new ParseUUIDPipe()) prescriptionId: string,
    @Body() body: UpdatePrescriptionDto,
  ): Promise<PrescriptionDetail> {
    return this.prescriptions.updateDraft(tenant, prescriptionId, body);
  }

  @Post('prescriptions/:prescriptionId/finalize')
  @RequirePermissions(PERMISSIONS.CLINICAL.PRESCRIPTIONS_FINALIZE)
  finalize(
    @CurrentTenant() tenant: TenantContext,
    @Param('prescriptionId', new ParseUUIDPipe()) prescriptionId: string,
    @Body() body: PrescriptionVersionDto,
  ): Promise<PrescriptionDetail> {
    return this.prescriptions.finalize(tenant, prescriptionId, body);
  }

  @Post('prescriptions/:prescriptionId/void')
  @RequirePermissions(PERMISSIONS.CLINICAL.PRESCRIPTIONS_VOID)
  void(
    @CurrentTenant() tenant: TenantContext,
    @Param('prescriptionId', new ParseUUIDPipe()) prescriptionId: string,
    @Body() body: VoidPrescriptionDto,
  ): Promise<PrescriptionDetail> {
    return this.prescriptions.void(tenant, prescriptionId, body);
  }
}
