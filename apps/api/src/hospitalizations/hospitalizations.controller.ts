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
  HospitalizationDetail,
  HospitalizationEntriesResponse,
  HospitalizationEntry,
  HospitalizationListResponse,
} from '@veterinary-saas/contracts';
import { CurrentTenant } from '../authorization/current-tenant.decorator';
import { PermissionGuard } from '../authorization/permission.guard';
import { PERMISSIONS } from '../authorization/permissions';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import type { TenantContext } from '../authorization/authorization.types';
import { TenantContextGuard } from '../authorization/tenant-context.guard';
import {
  CreateHospitalizationDto,
  CreateHospitalizationEntryDto,
  DischargeHospitalizationDto,
  HospitalizationEntriesQueryDto,
  HospitalizationListQueryDto,
  HospitalizationVersionDto,
  UpdateHospitalizationDto,
  VoidHospitalizationDto,
} from './hospitalization.dto';
import { HospitalizationsService } from './hospitalizations.service';

// Routes expose aggregate lifecycle operations but deliberately no physical or entry deletion.
@Controller()
@UseGuards(TenantContextGuard, PermissionGuard)
export class HospitalizationsController {
  constructor(private readonly hospitalizations: HospitalizationsService) {}

  @Get('patients/:patientId/hospitalizations')
  @RequirePermissions(PERMISSIONS.CLINICAL.HOSPITALIZATIONS_READ)
  listByPatient(
    @CurrentTenant() tenant: TenantContext,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Query() query: HospitalizationListQueryDto,
  ): Promise<HospitalizationListResponse> {
    return this.hospitalizations.listByPatient(tenant, patientId, query);
  }

  @Get('hospitalizations/:hospitalizationId')
  @RequirePermissions(PERMISSIONS.CLINICAL.HOSPITALIZATIONS_READ)
  findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('hospitalizationId', new ParseUUIDPipe()) id: string,
  ): Promise<HospitalizationDetail> {
    return this.hospitalizations.findOne(tenant, id);
  }

  @Post('clinical-encounters/:encounterId/hospitalization')
  @RequirePermissions(PERMISSIONS.CLINICAL.HOSPITALIZATIONS_CREATE)
  create(
    @CurrentTenant() tenant: TenantContext,
    @Param('encounterId', new ParseUUIDPipe()) encounterId: string,
    @Body() body: CreateHospitalizationDto,
  ): Promise<HospitalizationDetail> {
    return this.hospitalizations.create(tenant, encounterId, body);
  }

  @Patch('hospitalizations/:hospitalizationId')
  @RequirePermissions(PERMISSIONS.CLINICAL.HOSPITALIZATIONS_UPDATE)
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('hospitalizationId', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateHospitalizationDto,
  ): Promise<HospitalizationDetail> {
    return this.hospitalizations.updateDraft(tenant, id, body);
  }

  @Post('hospitalizations/:hospitalizationId/activate')
  @RequirePermissions(PERMISSIONS.CLINICAL.HOSPITALIZATIONS_ACTIVATE)
  activate(
    @CurrentTenant() tenant: TenantContext,
    @Param('hospitalizationId', new ParseUUIDPipe()) id: string,
    @Body() body: HospitalizationVersionDto,
  ): Promise<HospitalizationDetail> {
    return this.hospitalizations.activate(tenant, id, body.expectedVersion);
  }

  @Get('hospitalizations/:hospitalizationId/entries')
  @RequirePermissions(PERMISSIONS.CLINICAL.HOSPITALIZATIONS_READ)
  listEntries(
    @CurrentTenant() tenant: TenantContext,
    @Param('hospitalizationId', new ParseUUIDPipe()) id: string,
    @Query() query: HospitalizationEntriesQueryDto,
  ): Promise<HospitalizationEntriesResponse> {
    return this.hospitalizations.listEntries(tenant, id, query);
  }

  @Post('hospitalizations/:hospitalizationId/entries')
  @RequirePermissions(PERMISSIONS.CLINICAL.HOSPITALIZATION_ENTRIES_CREATE)
  createEntry(
    @CurrentTenant() tenant: TenantContext,
    @Param('hospitalizationId', new ParseUUIDPipe()) id: string,
    @Body() body: CreateHospitalizationEntryDto,
  ): Promise<HospitalizationEntry> {
    return this.hospitalizations.createEntry(tenant, id, body);
  }

  @Post('hospitalizations/:hospitalizationId/discharge')
  @RequirePermissions(PERMISSIONS.CLINICAL.HOSPITALIZATIONS_DISCHARGE)
  discharge(
    @CurrentTenant() tenant: TenantContext,
    @Param('hospitalizationId', new ParseUUIDPipe()) id: string,
    @Body() body: DischargeHospitalizationDto,
  ): Promise<HospitalizationDetail> {
    return this.hospitalizations.discharge(tenant, id, body);
  }

  @Post('hospitalizations/:hospitalizationId/void')
  @RequirePermissions(PERMISSIONS.CLINICAL.HOSPITALIZATIONS_VOID)
  void(
    @CurrentTenant() tenant: TenantContext,
    @Param('hospitalizationId', new ParseUUIDPipe()) id: string,
    @Body() body: VoidHospitalizationDto,
  ): Promise<HospitalizationDetail> {
    return this.hospitalizations.void(tenant, id, body);
  }
}
