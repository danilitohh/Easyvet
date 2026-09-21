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
import type { VaccinationDetail, VaccinationListResponse } from '@veterinary-saas/contracts';
import { CurrentTenant } from '../authorization/current-tenant.decorator';
import { PermissionGuard } from '../authorization/permission.guard';
import { PERMISSIONS } from '../authorization/permissions';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import type { TenantContext } from '../authorization/authorization.types';
import { TenantContextGuard } from '../authorization/tenant-context.guard';
import {
  CreateVaccinationDto,
  FinalizeVaccinationDto,
  UpdateVaccinationDto,
  VaccinationListQueryDto,
  VoidVaccinationDto,
} from './vaccination.dto';
import { VaccinationsService } from './vaccinations.service';

// Vaccination routes expose only aggregate operations; no child or delete endpoints exist.
@Controller()
@UseGuards(TenantContextGuard, PermissionGuard)
export class VaccinationsController {
  constructor(private readonly vaccinations: VaccinationsService) {}

  @Get('patients/:patientId/vaccinations')
  @RequirePermissions(PERMISSIONS.CLINICAL.VACCINATIONS_READ)
  listByPatient(
    @CurrentTenant() tenant: TenantContext,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Query() query: VaccinationListQueryDto,
  ): Promise<VaccinationListResponse> {
    return this.vaccinations.listByPatient(tenant, patientId, query);
  }

  @Get('vaccinations/:vaccinationId')
  @RequirePermissions(PERMISSIONS.CLINICAL.VACCINATIONS_READ)
  findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('vaccinationId', new ParseUUIDPipe()) vaccinationId: string,
  ): Promise<VaccinationDetail> {
    return this.vaccinations.findOne(tenant, vaccinationId);
  }

  @Post('clinical-encounters/:encounterId/vaccinations')
  @RequirePermissions(PERMISSIONS.CLINICAL.VACCINATIONS_CREATE)
  create(
    @CurrentTenant() tenant: TenantContext,
    @Param('encounterId', new ParseUUIDPipe()) encounterId: string,
    @Body() body: CreateVaccinationDto,
  ): Promise<VaccinationDetail> {
    return this.vaccinations.create(tenant, encounterId, body);
  }

  @Patch('vaccinations/:vaccinationId')
  @RequirePermissions(PERMISSIONS.CLINICAL.VACCINATIONS_UPDATE_DRAFT)
  updateDraft(
    @CurrentTenant() tenant: TenantContext,
    @Param('vaccinationId', new ParseUUIDPipe()) vaccinationId: string,
    @Body() body: UpdateVaccinationDto,
  ): Promise<VaccinationDetail> {
    return this.vaccinations.updateDraft(tenant, vaccinationId, body);
  }

  @Post('vaccinations/:vaccinationId/finalize')
  @RequirePermissions(PERMISSIONS.CLINICAL.VACCINATIONS_FINALIZE)
  finalize(
    @CurrentTenant() tenant: TenantContext,
    @Param('vaccinationId', new ParseUUIDPipe()) vaccinationId: string,
    @Body() body: FinalizeVaccinationDto,
  ): Promise<VaccinationDetail> {
    return this.vaccinations.finalize(tenant, vaccinationId, body);
  }

  @Post('vaccinations/:vaccinationId/void')
  @RequirePermissions(PERMISSIONS.CLINICAL.VACCINATIONS_VOID)
  void(
    @CurrentTenant() tenant: TenantContext,
    @Param('vaccinationId', new ParseUUIDPipe()) vaccinationId: string,
    @Body() body: VoidVaccinationDto,
  ): Promise<VaccinationDetail> {
    return this.vaccinations.void(tenant, vaccinationId, body);
  }
}
